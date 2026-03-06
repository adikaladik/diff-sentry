/**
 * Diff Sentry — PR Comment Reporter
 * Formats analysis results into GitHub PR comment markdown
 */

function levelEmoji(level) {
  return level === 'HIGH' ? '🔴' : level === 'MEDIUM' ? '🟡' : '🟢';
}

function buildPRComment(analysis, options = {}) {
  const { repoName = '', prNumber = '', commitSha = '' } = options;
  const { summary, riskyFiles, safe } = analysis;

  if (safe) {
    return `## ✅ Diff Sentry — No risky changes detected

All **${summary.total}** changed files look clean. No auth, config, infra, or database patterns flagged.

<sub>Powered by [Diff Sentry](https://diffsentry.dev) · AI-safe code review</sub>`;
  }

  const lines = [];
  lines.push(`## ⚠️ Diff Sentry — Risky changes detected\n`);

  if (summary.high > 0) {
    lines.push(`> 🔴 **${summary.high} HIGH-risk file${summary.high > 1 ? 's' : ''}** require your attention before merging.\n`);
  }

  lines.push(`**${summary.riskyFiles}** of **${summary.total}** changed files flagged:\n`);

  // Per-file breakdown
  for (const file of riskyFiles) {
    const topRisk = file.risks[0];
    lines.push(`### ${levelEmoji(file.maxRiskLevel)} \`${file.path}\``);
    lines.push(`**Risk level:** ${file.maxRiskLevel} · +${file.addedLines} / -${file.removedLines} lines\n`);

    lines.push(`| Category | Reason |`);
    lines.push(`|----------|--------|`);
    for (const risk of file.risks) {
      lines.push(`| ${risk.label} | ${risk.reason} |`);
    }
    lines.push('');
  }

  // Summary table
  lines.push(`---`);
  lines.push(`### Summary`);
  lines.push(`| Risk Level | Files |`);
  lines.push(`|------------|-------|`);
  lines.push(`| 🔴 HIGH | ${summary.high} |`);
  lines.push(`| 🟡 MEDIUM | ${summary.medium} |`);
  lines.push(`| 🟢 LOW | ${summary.low} |`);
  lines.push('');

  lines.push(`**Action required:** Review the flagged files carefully. These changes may have been generated or modified by an AI coding assistant and could affect security, configuration, or infrastructure.\n`);
  lines.push(`<sub>Powered by [Diff Sentry](https://diffsentry.dev) · AI-safe code review</sub>`);

  return lines.join('\n');
}

module.exports = { buildPRComment };
