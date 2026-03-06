/**
 * Diff Sentry — Risk analyzer
 * Parses git diff output and flags risky AI-generated changes
 */

const RISK_PATTERNS = {
  AUTH: {
    level: 'HIGH',
    label: '🔐 Auth / Security',
    files: [
      /auth/i, /jwt/i, /session/i, /oauth/i, /passport/i,
      /middleware\/.*auth/i, /guards?\//i, /permissions?\//i,
      /crypto/i, /bcrypt/i, /hash/i, /secret/i, /token/i,
    ],
    content: [
      /password/i, /secret/i, /private_key/i, /api_key/i,
      /bearer/i, /authorization/i, /jwt\.sign/i, /jwt\.verify/i,
    ],
  },
  ENV_CONFIG: {
    level: 'HIGH',
    label: '⚙️ Environment / Config',
    files: [
      /\.env/i, /config\.(js|ts|json|yml|yaml)/i,
      /settings\.(js|ts|py)/i, /\.secrets/i,
      /docker-compose/i, /dockerfile/i,
    ],
    content: [
      /process\.env/i, /os\.environ/i, /getenv/i,
    ],
  },
  INFRA: {
    level: 'HIGH',
    label: '🏗️ Infrastructure / CI',
    files: [
      /\.github\/workflows/i, /\.gitlab-ci/i, /\.circleci/i,
      /terraform/i, /pulumi/i, /k8s/i, /kubernetes/i,
      /nginx\.conf/i, /apache/i, /Makefile/i,
    ],
    content: [],
  },
  DATABASE: {
    level: 'HIGH',
    label: '🗄️ Database / Migrations',
    files: [
      /migration/i, /schema\.(sql|prisma|rb)/i,
      /seeds?\./i, /db\/.*\.(js|ts|sql|py)/i,
    ],
    content: [
      /DROP TABLE/i, /DELETE FROM/i, /ALTER TABLE/i,
      /TRUNCATE/i, /prisma\.migrate/i,
    ],
  },
  PACKAGE: {
    level: 'MEDIUM',
    label: '📦 Dependencies',
    files: [
      /package\.json$/i, /requirements\.txt$/i,
      /Gemfile$/i, /go\.mod$/i, /Cargo\.toml$/i,
      /pyproject\.toml$/i, /composer\.json$/i,
    ],
    content: [],
  },
  PAYMENTS: {
    level: 'HIGH',
    label: '💳 Payments / Billing',
    files: [
      /payment/i, /billing/i, /stripe/i, /checkout/i,
      /subscription/i, /invoice/i, /webhook/i,
    ],
    content: [
      /stripe\./i, /paymentIntent/i, /createCharge/i,
    ],
  },
};

/**
 * Parse unified diff into file-level change objects
 */
function parseDiff(diffText) {
  const files = [];
  let current = null;
  const lines = diffText.split('\n');

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (current) files.push(current);
      const match = line.match(/diff --git a\/(.*) b\/(.*)/);
      current = {
        path: match ? match[2] : line,
        added: [],
        removed: [],
        addedCount: 0,
        removedCount: 0,
      };
    } else if (current) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        current.added.push(line.slice(1));
        current.addedCount++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        current.removed.push(line.slice(1));
        current.removedCount++;
      }
    }
  }
  if (current) files.push(current);
  return files;
}

/**
 * Analyze a single file diff for risk
 */
function analyzeFile(file) {
  const risks = [];

  for (const [category, pattern] of Object.entries(RISK_PATTERNS)) {
    // Check filename
    const fileMatch = pattern.files.some(re => re.test(file.path));
    
    // Check added content lines
    const allAdded = file.added.join('\n');
    const contentMatch = pattern.content.some(re => re.test(allAdded));

    if (fileMatch || contentMatch) {
      risks.push({
        category,
        level: pattern.level,
        label: pattern.label,
        reason: fileMatch ? `file matches ${category} pattern` : `content matches ${category} pattern`,
      });
    }
  }

  return {
    path: file.path,
    addedLines: file.addedCount,
    removedLines: file.removedCount,
    risks,
    maxRiskLevel: risks.some(r => r.level === 'HIGH') ? 'HIGH'
      : risks.some(r => r.level === 'MEDIUM') ? 'MEDIUM'
      : 'LOW',
  };
}

/**
 * Main analysis entry point
 * @param {string} diffText - Raw git diff output
 * @returns {object} Analysis result with per-file risks and summary
 */
function analyzeDiff(diffText, options = {}) {
  const { fileLimit } = options;
  if (!diffText || !diffText.trim()) {
    return { files: [], summary: { high: 0, medium: 0, low: 0, total: 0 }, safe: true };
  }

  let files = parseDiff(diffText);
  const truncated = fileLimit && files.length > fileLimit;
  if (truncated) files = files.slice(0, fileLimit);
  const analyzed = files.map(analyzeFile);

  const risky = analyzed.filter(f => f.risks.length > 0);
  const summary = {
    total: analyzed.length,
    high: risky.filter(f => f.maxRiskLevel === 'HIGH').length,
    medium: risky.filter(f => f.maxRiskLevel === 'MEDIUM').length,
    low: risky.filter(f => f.maxRiskLevel === 'LOW').length,
    riskyFiles: risky.length,
  };

  return {
    files: analyzed,
    riskyFiles: risky,
    summary,
    safe: summary.high === 0 && summary.medium === 0,
    truncated: truncated || false,
    fileLimit: fileLimit || null,
  };
}

module.exports = { analyzeDiff, parseDiff, analyzeFile };
