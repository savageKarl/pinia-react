# Contributing to Pinia-React

Thank you for contributing to Pinia-React. This document describes the repository workflow, development requirements, pull request expectations, Changesets policy, and release process.

## Repository Structure

This repository is a pnpm workspace containing the following main projects:

| Path | Purpose |
| --- | --- |
| `packages/pinia` | The `pinia-react` core package. |
| `packages/devtools` | The `@pinia-react/devtools` Redux DevTools plugin. |
| `packages/docs` | The Rspress documentation site. |
| `packages/playground/react` | React playground for manual testing. |
| `packages/playground/nextjs` | Next.js playground for manual testing. |

External contributions may update multiple publishable packages in one pull request when the changes belong to the same feature or fix.

## Development Requirements

The CI environment uses:

- Node.js 22
- pnpm 10

Install dependencies from the repository root:

```bash
pnpm install
```

CI installs dependencies with `pnpm install --frozen-lockfile`. Commit `pnpm-lock.yaml` when an intentional dependency change updates it.

## Development Commands

Run commands from the repository root unless stated otherwise.

```bash
# Check formatting and lint rules
pnpm run check

# Run all unit tests
pnpm run test

# Run all TypeScript definition tests
pnpm run test-dts

# Build all packages
pnpm run build

# Build the documentation site
pnpm run docs-build
```

Package-specific commands can be run with pnpm filters:

```bash
pnpm --filter pinia-react test -- --run
pnpm --filter pinia-react test-dts
pnpm --filter @pinia-react/devtools test -- --run
pnpm --filter @pinia-react/devtools test-dts
```

## Branch Workflow

The repository uses `main` as its primary branch. Contributors should work in a separate branch created from the latest `main`:

```bash
git fetch origin
git switch -c feat/example origin/main
```

Keep each branch focused on one coherent feature, fix, or maintenance task. Branch prefixes such as `feat/`, `fix/`, `docs/`, `refactor/`, and `test/` are recommended but not required.

Before requesting a final review, update the branch against the latest `main` when necessary:

```bash
git fetch origin
git rebase origin/main
```

Resolve any rebase conflicts in the contribution branch and update the pull request. Do not merge `main` into the contribution branch unless a maintainer specifically requests it.

Contributors open normal pull requests. Repository maintainers review and merge accepted pull requests. Contributors must not merge Changesets release pull requests.

## Commit Messages

All commit messages must follow the [Conventional Commits 1.0.0 specification](https://www.conventionalcommits.org/en/v1.0.0/). The repository configures Commitlint with the conventional rules and runs it through the local commit message hook.

The basic format is:

```text
<type>[optional scope]: <description>
```

Examples:

```text
feat(pinia): add a store mutation hook
fix(devtools): restore imported state correctly
docs: document the devtools plugin
test(pinia): cover cross-store getter invalidation
chore: update development dependencies
```

Use `!` or a `BREAKING CHANGE:` footer for breaking changes:

```text
feat(pinia)!: change the plugin context contract
```

## Pull Request Requirements

A pull request should:

- Address one coherent change.
- Explain the user-visible behavior and motivation.
- Avoid unrelated refactoring or formatting changes.
- Update relevant documentation when public behavior or APIs change.
- Include a Changeset when the change requires a package release.
- Pass formatting, lint, tests, type tests, Changesets validation, and builds in CI.

New features must include both:

- Unit tests covering runtime behavior.
- Type definition tests covering the public TypeScript API.

Bug fixes should include a regression test whenever the behavior can be reproduced in an automated test.

## Changesets

Changesets describe user-visible package changes and determine package version updates. Changeset summaries must be written in English.

Create a Changeset from the repository root:

```bash
pnpm exec changeset
```

Select every publishable package affected by the pull request:

- `pinia-react`
- `@pinia-react/devtools`

Choose the version impact independently for each selected package:

- `patch`: Backward-compatible bug fixes and small user-visible corrections.
- `minor`: Backward-compatible features or public API additions.
- `major`: Breaking changes to behavior or public APIs.

A good Changeset summary explains the effect for package users. It should not be a commit log or a description of internal implementation steps.

```md
---
'pinia-react': minor
'@pinia-react/devtools': patch
---

Expose mutation metadata to plugins and display the additional metadata in Redux DevTools.
```

Do not manually update package versions or generated changelog entries. The release workflow handles those updates.

### When a Changeset Is Required

Changesets considers these files inside each workspace package release-relevant:

```text
src/**
package.json
tsup.config.ts
```

Changes to these files require a Changeset unless they have no user-visible release impact. For an exceptional internal-only change under a release-relevant path, create an empty Changeset to record that decision:

```bash
pnpm exec changeset add --empty
```

Changes limited to the following areas normally do not require a Changeset:

```text
README files
CHANGELOG files
tests/**
test-dts/**
packages/docs/**
packages/playground/**
.github/**
```

Documentation or test changes accompanying a release-related source change do not remove the requirement for a Changeset.

## Review and Merge Process

The expected contribution flow is:

1. Create a branch from `main`.
2. Implement the change and its tests.
3. Add or update documentation where needed.
4. Add a Changeset when the change affects a published package.
5. Run the relevant checks locally.
6. Open a pull request targeting `main`.
7. Address review feedback and rebase when required.
8. A maintainer reviews and merges the pull request.

Maintainers determine when a pull request is ready to merge. If the branch conflicts with the latest `main`, the contributor must resolve the conflicts before it can be merged.

## Release Process

Publishing is maintainer-only. Contributors should not publish packages, run the versioning workflow manually, or merge release pull requests.

After normal pull requests containing Changesets are merged into `main`:

1. The release workflow collects pending Changesets.
2. Changesets Action creates or updates a release pull request.
3. The release pull request updates package versions and changelogs.
4. A project maintainer reviews and merges the release pull request.
5. The release workflow builds, tests, and publishes the packages to npm.

The generated `changeset-release/*` pull request is managed and merged only by project maintainers.

## Documentation Contributions

User documentation is maintained in both English and Chinese:

```text
packages/docs/docs/en
packages/docs/docs/zh
```

When changing user-facing documentation for a feature, update both language versions when equivalent pages exist. Documentation-only changes do not require a package Changeset.

Validate documentation changes with:

```bash
pnpm run docs-build
```
