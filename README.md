# 🛡️ Diff Sentry

**Catch risky AI-generated code before it hits production.**

Diff Sentry is a GitHub Action that scans every pull request for high-risk changes — auth, secrets, env vars, DB migrations, infra — and posts a clear risk report as a PR comment.

[![Diff Sentry](https://img.shields.io/badge/Diff%20Sentry-protected-red)](https://diffsentry.dev)

---

## Why

AI coding tools (Copilot, Cursor, Claude) generate code fast. But they also hallucinate auth bypasses, misconfigure env vars, and produce DB migrations that can silently corrupt data. Your reviewers are human — they miss things, especially in large AI-generated diffs.

Diff Sentry adds an automated safety layer that flags the high-risk files before anyone hits merge.

---

## What It Flags

| Category | Examples |
|----------|---------|
| 🔐 Auth & Security | JWT logic, session handling, OAuth flows, password hashing |
| 🔑 Secrets & Env Vars | `.env` files, hardcoded credentials, secret references |
| 🗄️ DB Migrations | Schema changes, column drops, index modifications |
| ☁️ Infra & Cloud | Terraform, Kubernetes, Docker, AWS/GCP configs |
| ⚙️ App Configuration | Config files, feature flags, settings |
| 🌐 API & Network | New endpoints, CORS changes, external service calls |

---

## Setup

### 1. Get a license key

Purchase at [diffsentry.dev](https://diffsentry.dev) — $19 one-time, lifetime updates.

### 2. Add your license key as a GitHub secret

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

- Name: `DIFF_SENTRY_KEY`
- Value: your license key (e.g. `DS-XXXXXXXXXXXXXXXXXXXX`)

### 3. Add the workflow

Create `.github/workflows/diff-sentry.yml`:

```yaml
name: Diff Sentry

on:
  pull_request:
    branches: [main]

permissions:
  pull-requests: write
  contents: read

jobs:
  diff-sentry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: adikaladik/diff-sentry@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          license-key: ${{ secrets.DIFF_SENTRY_KEY }}
```

That's it. Every PR now gets an automatic risk report.

---

## Configuration

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | ✅ | — | GitHub token for posting PR comments |
| `license-key` | ✅ | — | Your Diff Sentry license key |
| `fail-on-high` | ❌ | `false` | Fail the check if HIGH-risk files are found |

### Strict mode

Block merges when HIGH-risk changes are detected:

```yaml
- uses: adikaladik/diff-sentry@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    license-key: ${{ secrets.DIFF_SENTRY_KEY }}
    fail-on-high: 'true'
```

---

## Example Output

When Diff Sentry detects risky changes, it posts a comment on the PR:

```
⚠️ Diff Sentry — Risky changes detected

🔴 1 HIGH-risk file requires your attention before merging.

🔴 auth/token.js — HIGH · +6 / -0 lines
  🔐 Auth / Security — file matches AUTH pattern
  ⚙️ Environment / Config — content matches ENV_CONFIG pattern

Summary:
  🔴 HIGH    1
  🟡 MEDIUM  0
  🟢 LOW     0
```

---

## License

Requires a valid license key from [diffsentry.dev](https://diffsentry.dev).  
$19 one-time payment · No subscription · Lifetime updates.

---

## Support

Questions or issues? Email [hello@diffsentry.dev](mailto:hello@diffsentry.dev)
