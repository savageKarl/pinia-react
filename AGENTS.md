# Agent Development Guide

This document defines how agents should work in this repository. It is a development operating guide and does not replace the user documentation, API documentation, or complete contribution guide.

## Scope and Rule Priority

- These rules apply to the entire repository.
- The user's explicit requirements take priority over this document.
- Branches, commits, Pull Requests, Changesets, and the release process are governed by `CONTRIBUTING.md`.
- If a more specific `AGENTS.md` is added in a subdirectory in the future, its rules apply to that subdirectory.
- For analysis-only tasks, do not modify files. Edit the repository only when the user asks for implementation, a fix, documentation, or another write operation.

## Standard Development Process

For implementation tasks, follow these steps in order:

1. Check the current branch and working tree status before editing. Do not develop, modify, or commit on the `main` branch. If currently on `main`, create or switch to a task branch before editing. Preserve existing user changes; do not reset or overwrite them.
2. Before deciding on an approach, read the relevant source code, tests, package manifests, and existing documentation.
3. Determine the affected packages, public APIs, runtime behavior, and release impact.
4. Find existing tests that cover the target behavior. If coverage is missing or the current behavior is defective, add a focused regression test first.
5. Make the smallest complete implementation change. Avoid unrelated refactoring, formatting noise, and abstractions that are not clearly necessary.
6. Update type tests, user documentation, bilingual documentation, and the Changeset as needed.
7. Run the smallest relevant checks first. For cross-package or public API changes, run the complete checks afterward.
8. Review the final diff and working tree status to confirm there are no generated files, unrelated changes, missing tests, or missing release documentation.
9. Report the actual changes made, checks actually run, and any remaining environment or test limitations. Do not report checks as passing if they were not run.

## Repository Directory Boundaries

| Path | Boundary and requirements |
| --- | --- |
| `packages/pinia/src` | Publishable core runtime and public types. Changes require careful review of runtime behavior, types, and compatibility. |
| `packages/pinia/tests` | Runtime behavior and regression tests for the core package. |
| `packages/pinia/test-dts` | Compile-time tests for the public TypeScript API. |
| `packages/devtools/src` | Redux DevTools adapter layer for `pinia-react`; it must not evolve into a second state management layer. |
| `packages/devtools/tests` and `packages/devtools/test-dts` | Runtime and public type tests for the DevTools package. |
| `packages/docs` | Private Rspress documentation site. When a corresponding page exists, English and Chinese content must remain synchronized. |
| `packages/playground` | Private manual verification application. Do not move a playground-only temporary workaround into a publishable package unless it represents a library-level requirement and has corresponding tests. |
| `.github` | CI, release, and documentation deployment workflows. Modify this directory only when the task involves workflow behavior. |
| `dist`, `coverage`, `.next`, and other ignored output directories | Generated artifacts. Do not edit or commit them directly. |

Unless required by dependencies or user-visible behavior, do not extend a package change to other packages. Changes to root-level configuration must have a clear workspace-level justification.

## Change Decision Matrix

Use the following matrix to determine which follow-up work is required for a change:

| Change type | Required follow-up work |
| --- | --- |
| Core runtime behavior in `packages/pinia/src` | Add or update focused runtime tests, and check affected type behavior and the build result. |
| Public APIs, exported types, or declaration behavior | Add runtime tests where applicable, update `test-dts`, check user documentation, and assess whether a Changeset is needed. |
| Getter dependencies, cross-store access, subscriptions, patches, reset, restore, or asynchronous action behavior | Add regression tests for affected lifecycles and edge cases. |
| DevTools message handling or state restoration | Test the Redux DevTools protocol, mutation-origin filtering, and applicable browser/SSR boundaries. |
| User-visible documentation | When corresponding English and Chinese pages exist, update both; update navigation metadata when needed. |
| Changes limited to `tests/**`, `test-dts/**`, documentation, the playground, or CI | Usually no Changeset is needed, but run checks relevant to the modified scope. |
| `src/**`, `package.json`, or `tsup.config.ts` in a publishable package | Follow the Changeset rules in `CONTRIBUTING.md`; do not manually modify version numbers. |

Do not make tests pass by deleting tests, weakening type checking, changing expected public behavior without documenting it, or using broad type assertions.

## Core Runtime Constraints

The following are behavioral contracts that must be preserved, not implementation preferences that may be changed freely:

- `createPinia()` creates a Pinia instance and makes it active. Store instances and internal scopes from different Pinia instances must remain isolated from one another.
- `defineStore()` provides both a `useStore` for React components and a `getStore` for non-hook scenarios. Generated named aliases must remain type-safe.
- Public store state is read-only. State changes must go through actions, `$patch`, `$reset`, or `restoreState`, which is intended only for plugins.
- Every committed mutation must keep the store scope, `pinia.state`, Immer patches, listeners, getter caches, and `MutationEvent` metadata consistent.
- `useStore` relies on `useSyncExternalStore` and path-level dependency tracking. Do not introduce unrelated component re-renders or break the snapshot/subscription contract.
- Getter results are cached and invalidated according to their tracked dependencies. Cross-store getter dependencies and circular-dependency warnings must continue to work.
- State changes made by an action after `await` must still go through the same mutation lifecycle; do not bypass patch dispatch or subscription notifications.
- Plugins are applied when a store is created. Do not silently change the existing behavior in which registering a plugin after a store has been created does not affect that store.
- DevTools state restoration must preserve the mutation origin so that the integration layer does not send its own restore events back to Redux DevTools.
- The core uses an isolated Immer instance. Using the core library must not modify the host application's global Immer configuration.

Before modifying `packages/pinia/src/store.ts`, read the surrounding runtime tests and then decide whether the state machine needs to change. Prefer a narrowly scoped fix over a large rewrite.

## Verification Rules

The supported local toolchain is Node.js 22 and pnpm 10. Run commands from the repository root.

### Focused Checks

```bash
pnpm --filter pinia-react test -- --run
pnpm --filter pinia-react test-dts
pnpm --filter @pinia-react/devtools test -- --run
pnpm --filter @pinia-react/devtools test-dts
pnpm run docs-build
```

### Complete Checks

```bash
pnpm run check
pnpm run test
pnpm run test-dts
pnpm run build
```

Use focused checks for isolated, small changes. Run the complete checks for cross-package changes, shared configuration changes, public API changes, or build/release behavior changes.

If a command fails because of dependency installation, permissions, network access, or another environment issue, distinguish the environment failure from a code failure. Do not silently skip the command; report the specific limitation and continue with independent checks that can still run.

## Git and Security Boundaries

- Use `main` only as a synchronization and release baseline, not for day-to-day development. All code, test, documentation, and configuration changes must be made on a task branch, and all commits must be made on a task branch.
- Task branches should use the `codex/` prefix by default and a short name that describes the purpose, such as `codex/update-agents-guide`.
- If currently on `main`, check the working tree status first, then create or switch to a task branch. Do not discard or overwrite existing changes to switch branches.
- Do not use destructive commands such as `git reset --hard` or `git checkout --` unless the user explicitly requests them.
- Do not revert, reformat, or delete unrelated changes that already belong to the user.
- Do not edit generated artifacts or dependency caches to conceal source-code problems.
- Unless the user explicitly requests it, do not create commits, Pull Requests, releases, or publish packages. Creating a task branch is allowed to comply with the branch rule, but do not create unrelated branches.
- Do not manually modify package versions or generated changelogs.
- Do not expand the current task into unrequested cleanup or refactoring.

## Completion Criteria

An implementation task is complete only when all of the following conditions are met:

- The scope of the changes is limited to the behavior and affected boundaries requested by the user.
- Existing user changes are preserved.
- Required runtime and type tests have been added, or there is a clear explanation of why they are not needed.
- Documentation and Changeset requirements have been assessed.
- Relevant checks have actually been run and failures and limitations are reported accurately.
- The final diff contains no unrelated files or generated artifacts.
- The final report explains the changes made, verification performed, and unresolved issues.

Read `CONTRIBUTING.md` before creating or updating contributions for the contribution process, commit conventions, Pull Requests, documentation policy, and release details.
