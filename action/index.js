/**
 * Diff Sentry — GitHub Action Entry Point
 */
const core = require('@actions/core');
const github = require('@actions/github');
const { execSync } = require('child_process');
const { analyzeDiff } = require('../src/analyzer');
const { buildPRComment } = require('../src/reporter');

async function run() {
  try {
    const token = core.getInput('github-token', { required: true });
    const licenseKey = core.getInput('license-key');
    const failOnHigh = core.getInput('fail-on-high') === 'true';
    const apiUrl = core.getInput('api-url') || 'https://api.diffsentry.dev';

    // Validate license key (skip in free/trial mode)
    if (licenseKey) {
      try {
        const res = await fetch(`${apiUrl}/v1/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: licenseKey, repo: process.env.GITHUB_REPOSITORY }),
        });
        const data = await res.json();
        if (!data.valid) {
          core.warning(`Diff Sentry: Invalid license key. Running in free mode (limited to 3 files).`);
        }
      } catch {
        core.warning('Diff Sentry: Could not validate license. Running in free mode.');
      }
    } else {
      core.info('Diff Sentry: No license key provided. Running in free mode (limited to 3 files).');
    }

    // Get the diff
    const context = github.context;
    const octokit = github.getOctokit(token);

    let diffText = '';

    if (context.eventName === 'pull_request') {
      const { data: diff } = await octokit.rest.pulls.get({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: context.payload.pull_request.number,
        mediaType: { format: 'diff' },
      });
      diffText = diff;
    } else {
      // Push event — diff against previous commit
      try {
        diffText = execSync('git diff HEAD~1 HEAD', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      } catch {
        core.warning('Could not get diff. Make sure fetch-depth > 1 in checkout step.');
        return;
      }
    }

    // Analyze
    const analysis = analyzeDiff(diffText);
    core.info(`Diff Sentry: Analyzed ${analysis.summary.total} files. ${analysis.summary.riskyFiles || 0} flagged.`);

    // Set outputs
    core.setOutput('high-risk-count', analysis.summary.high);
    core.setOutput('medium-risk-count', analysis.summary.medium);
    core.setOutput('safe', analysis.safe);
    core.setOutput('risky-files', JSON.stringify(analysis.riskyFiles.map(f => f.path)));

    // Post PR comment
    if (context.eventName === 'pull_request') {
      const comment = buildPRComment(analysis, {
        repoName: context.repo.repo,
        prNumber: context.payload.pull_request.number,
      });

      // Find and update existing comment, or create new one
      const { data: comments } = await octokit.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.pull_request.number,
      });

      const existing = comments.find(c => c.body.includes('Diff Sentry'));

      if (existing) {
        await octokit.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: existing.id,
          body: comment,
        });
      } else {
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.payload.pull_request.number,
          body: comment,
        });
      }
    }

    // Fail check if high-risk files found and flag is set
    if (failOnHigh && analysis.summary.high > 0) {
      core.setFailed(`Diff Sentry: ${analysis.summary.high} HIGH-risk file(s) detected. Review required before merging.`);
    }

  } catch (error) {
    core.setFailed(`Diff Sentry error: ${error.message}`);
  }
}

run();
