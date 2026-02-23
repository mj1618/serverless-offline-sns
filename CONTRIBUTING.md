# Contributing to serverless-offline-sns

Thank you for taking the time to contribute!

## Table of contents

- [Getting started](#getting-started)
- [Running tests](#running-tests)
- [Branch naming](#branch-naming)
- [Commit messages](#commit-messages)
- [Opening a pull request](#opening-a-pull-request)
- [How releases work](#how-releases-work)

---

## Getting started

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/serverless-offline-sns.git
   cd serverless-offline-sns
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript source:
   ```bash
   npm run build
   ```

## Running tests

```bash
node_modules/.bin/nyc node_modules/.bin/ts-mocha \
  -r ts-node/register --loader=ts-node/esm \
  --no-warnings=ExperimentalWarning \
  --experimental-specifier-resolution=node \
  "test/**/*.ts" -p test/tsconfig.json
```

All tests must pass before opening a PR.

## Branch naming

Use the format `{type}/{issue-number}-{short-description}`:

```
fix/179-localstack-arn
feat/215-publish-batch
docs/225-contributing-md
ci/226-semantic-pr-title
```

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/).
**Each PR must contain exactly one commit** — squash your work before opening the PR.

### Types that trigger a release

| Type | Release | When to use |
|------|---------|-------------|
| `fix:` | patch | A bug is corrected — consumers were getting wrong behaviour |
| `feat:` | minor | A new capability is added that consumers can use |
| `feat!:` / `BREAKING CHANGE:` footer | major | Existing behaviour changes in a way requiring consumers to update |

### Types that do not trigger a release

| Type | When to use |
|------|-------------|
| `docs:` | README, CONTRIBUTING, comments, or any human-readable text |
| `test:` | Adding or fixing tests only — no production code change |
| `refactor:` | Code restructured but behaviour is identical |
| `perf:` | Performance improvement with no behaviour change |
| `ci:` | GitHub Actions workflows, CI config, release tooling |
| `chore:` | Dependency bumps, tooling config, repo housekeeping |

### Examples

```
fix: pass queueName through CloudFormation subscriptions (closes #179)
feat: add PublishBatch support (closes #215)
docs: add CONTRIBUTING.md (closes #225)
ci: enforce semantic PR title via GitHub Actions (closes #226)
```

## Opening a pull request

1. Make sure your branch is up to date with `main`.
2. Squash all commits into **one semantic commit** before opening the PR.
3. Use the PR template — fill in what the PR does, why, and the issue it closes.
4. Ensure the PR title matches your commit message (it becomes the squash-merge commit message).

## How releases work

Releases are automated via [semantic-release](https://semantic-release.gitbook.io/).
When a PR is merged to `main`, semantic-release analyses the commit message and:

- `fix:` → publishes a **patch** release to npm
- `feat:` → publishes a **minor** release to npm
- `BREAKING CHANGE:` → publishes a **major** release to npm
- All other types → no release

A `CHANGELOG.md` and GitHub Release are generated automatically.
You do not need to manually bump `package.json` or create git tags.
