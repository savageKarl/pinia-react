# @pinia-react/devtools

## 1.0.1

### Patch Changes

- 8dc42f9: Release Store-owned Mutation and Redux DevTools subscriptions and the connection's own unsubscribe on instance disposal, failed Store initialization and duplicate-ID replacement. Register connection cleanup before initialization so an initialization error does not leak it. Ignore late and reentrant messages without disconnecting other instances or calling extension-wide disconnect.

  Complete cleanup requires the lifecycle-enabled core. Older contexts without onDispose retain their existing runtime behavior.

## 1.0.0

### Patch Changes

- Updated dependencies [938ce4e]
- Updated dependencies [938ce4e]
- Updated dependencies [68ffae6]
  - pinia-react@3.0.0

## 0.1.1

### Patch Changes

- e894f03: Fix CommonJS package exports, expose readonly store ids, make readonly mutations fail consistently, and support state keys containing dots in reactive tracking.
- Updated dependencies [e894f03]
- Updated dependencies [c5c7d1c]
- Updated dependencies [b9c81e4]
  - pinia-react@2.1.3

## 0.1.0

### Minor Changes

- 7e06634: Initial Redux DevTools Extension plugin for pinia-react.

### Patch Changes

- Updated dependencies [7e06634]
  - pinia-react@2.1.2
