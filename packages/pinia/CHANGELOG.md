# Changelog

## 2.0.0

### Major Changes

- 53f8432: ## **Changelog: Pinia-React Library Major Refactor & API Redesign**

  This release represents a fundamental rewrite, moving from a Vue-inspired reactivity model to a more modern, React-idiomatic architecture using Immer and `useSyncExternalStore`. This results in significant breaking changes but offers improved performance, enforced predictability, and a better developer experience within the React ecosystem.

  ### 💥 Major Breaking Changes (API & Usage)

  - **`defineStore` Return Value Changed**:
    - **Before**: `defineStore` returned a single function, `useStore`, which also had `$id` and `$getStore` properties attached to it.
      ```javascript
      // Old way
      export const useCounterStore = defineStore(...)
      // In component: useCounterStore()
      // Outside component: useCounterStore.$getStore()
      ```
    - **After**: `defineStore` now returns an object containing two separate functions: `{ useStore, getStore }`.
      ```javascript
      // New way
      export const { useStore: useCounterStore, getStore: getCounterStore } = defineStore(...)
      // In component: useCounterStore()
      // Outside component: getCounterStore()
      ```
  - **`$patch` API Signature Change**:
    - **Before**: The `$patch` method was overloaded, accepting either a partial state object or a mutator function.
      ```javascript
      // Old way
      store.$patch({ count: store.count + 1 }); // Object form
      store.$patch((state) => state.count++); // Function form
      ```
    - **After**: The `$patch` method **only accepts a single function** that receives an Immer `draft` object. The object-based patch has been removed.
      ```javascript
      // New way
      store.$patch((draft) => {
        draft.count++;
      });
      ```
  - **Enforced State Immutability**:
    - **Before**: The store's state was a `reactive` object from `@maoism/runtime-core`. You could directly mutate state from anywhere (e.g., `store.count++`).
    - **After**: The store instance is a Proxy that makes top-level state properties read-only outside of actions. Attempting to mutate state directly (e.g., `store.count++`) will now result in a console warning. All mutations **must** occur within an `action` or via `$patch`. This enforces a unidirectional data flow.
  - **Removal of `$onAction`**:
    - The `$onAction()` API for middleware-style listening to action calls has been completely removed. This functionality should now be handled by the plugin system for more robust and centralized logic.

  ### ✨ Core Architecture & Feature Enhancements

  - **Reactivity System Overhaul**:
    - The entire reactivity core based on `@maoism/runtime-core` (`ref`, `computed`, `reactive`, `effectScope`, `watch`) has been **completely removed**.
    - The new foundation is **Immer** for safe, immutable state updates and **`useSyncExternalStore`** for component subscriptions. This is the official, recommended approach for external stores in React 18, preventing tearing and ensuring concurrent rendering safety.
  - **Performance via Fine-Grained Subscriptions**:
    - The `useStore` hook now tracks dependencies at the property level (e.g., `store.user.name`). A component will only re-render if a state property or getter it specifically accessed during render is affected by a state update. This is a major performance boost, preventing unnecessary renders.
  - **Advanced Getter System**:
    - Getters now feature a robust, custom-built dependency tracking system, free from the old `computed` dependency.
    - **Cross-Store Dependencies**: Getters in `StoreA` can now safely access state or other getters from `StoreB`. The library automatically establishes a subscription, ensuring `StoreA`'s getter is invalidated and recalculated when its dependency in `StoreB` changes.
    - **Circular Dependency Detection**: The system now detects and warns about circular dependencies within getters.
  - **Improved Redux DevTools Integration**:
    - The integration is now more explicit and powerful, correctly handling time-travel features like `JUMP_TO_STATE`, `JUMP_TO_ACTION`, `ROLLBACK`, `COMMIT`, and `RESET` for a significantly improved debugging workflow.

  ### 🗑️ Removals & Simplifications

  - **Removed Files**: The utility files `subscription.ts` and `utils.ts` have been removed, with their logic being either replaced by Immer or consolidated into `store.ts`.
  - **Removed `MutationType` Enum**: The `MutationType` enum and associated complex subscription types have been removed. The new `$subscribe` callback is simpler, providing only the new and previous state: `(state, prevState) => void`.

  ### 📝 Type System Overhaul

  - **Vue-related Types Removed**: All types from `@maoism/runtime-core` (e.g., `Ref`, `UnwrapRef`, `ComputedRef`, `_GettersTree`, `_ActionsTree`) have been eliminated.
  - **Immer Types Introduced**: Core types now include `Draft` and `Patch` from Immer.
  - **New `StoreScope` Type**: A new `StoreScope` interface encapsulates the entire state of a store instance (`currentState`, `listeners`, `getterCache`, `getterDependencies`, etc.), simplifying the internal architecture. The global `pinia._scopes` map holds these scopes.
  - **Simplified Public Types**: The overall type surface area is greatly reduced, making the library easier to understand, extend, and maintain.

## [1.5.2](https://github.com/savageKarl/pinia-react/compare/v1.5.2-beta.2...v1.5.2) (2025-11-22)

## [1.5.2-beta.6](https://github.com/savageKarl/pinia-react/compare/v1.5.2-beta.5...v1.5.2-beta.6) (2025-09-29)

### Bug Fixes

- update deps ([49a4524](https://github.com/savageKarl/pinia-react/commit/49a4524c38d7d2d6d93a5d84def8ae649e311056))
- update deps ([47ab205](https://github.com/savageKarl/pinia-react/commit/47ab205ead13436ce0674edd5e049e93a4bb510d))

## [1.5.2-beta.5](https://github.com/savageKarl/pinia-react/compare/v1.5.2-beta.4...v1.5.2-beta.5) (2025-09-29)

### Bug Fixes

- update release.yaml ([98f1df7](https://github.com/savageKarl/pinia-react/commit/98f1df793a8346bcffa146f13de8db85a2ec8eaa))

## [1.5.2-beta.4](https://github.com/savageKarl/pinia-react/compare/v1.5.2-beta.3...v1.5.2-beta.4) (2025-09-29)

### Bug Fixes

- update version ([d37a6a4](https://github.com/savageKarl/pinia-react/commit/d37a6a44b5b8f784780b7b3486d57bfb12ff2d1a))

## [1.5.2-beta.1](https://github.com/savageKarl/pinia-react/compare/v1.5.1...v1.5.2-beta.1) (2025-09-26)

### Bug Fixes

- **pinia:** use interface to declare the definestoreoptionsbase type ([d04224f](https://github.com/savageKarl/pinia-react/commit/d04224f9ef6c7af266d9342197cafe95c4296858))

## [1.5.1](https://github.com/savageKarl/pinia-react/compare/v1.5.0...v1.5.1) (2025-09-06)

### Bug Fixes

- remove tsdown and update package.json ([80509ba](https://github.com/savageKarl/pinia-react/commit/80509bafac54431a22a8f418942ad617962915b1)), closes [#35](https://github.com/savageKarl/pinia-react/issues/35) [#37](https://github.com/savageKarl/pinia-react/issues/37)

## [1.5.1-beta.1](https://github.com/savageKarl/pinia-react/compare/v1.5.0...v1.5.1-beta.1) (2025-09-06)

### Bug Fixes

- remove tsdown and update package.json ([030566e](https://github.com/savageKarl/pinia-react/commit/030566eb570ce4f227af7e074757e4d72a671e44))
- resolve defineStore type inference error ([6f04346](https://github.com/savageKarl/pinia-react/commit/6f043467442d349d30076c0aee9e7db409727acd))
- update package.json for types config ([8ab1f68](https://github.com/savageKarl/pinia-react/commit/8ab1f68ca3f057fb88a345c15cf40dd93efb637f))

# [1.5.0-beta.4](https://github.com/savageKarl/pinia-react/compare/v1.5.0-beta.3...v1.5.0-beta.4) (2025-09-06)

### Bug Fixes

- remove tsdown and update package.json ([030566e](https://github.com/savageKarl/pinia-react/commit/030566eb570ce4f227af7e074757e4d72a671e44))

# [1.5.0-beta.3](https://github.com/savageKarl/pinia-react/compare/v1.5.0-beta.2...v1.5.0-beta.3) (2025-09-06)

### Bug Fixes

- update package.json for types config ([8ab1f68](https://github.com/savageKarl/pinia-react/commit/8ab1f68ca3f057fb88a345c15cf40dd93efb637f))

# [1.5.0-beta.2](https://github.com/savageKarl/pinia-react/compare/v1.5.0-beta.1...v1.5.0-beta.2) (2025-09-06)

### Bug Fixes

- # resolve defineStore type inference error ([6f04346](https://github.com/savageKarl/pinia-react/commit/6f043467442d349d30076c0aee9e7db409727acd))

# [1.5.0](https://github.com/savageKarl/pinia-react/compare/v1.4.0...v1.5.0) (2025-08-29)

### Features

- add docs ([c656c73](https://github.com/savageKarl/pinia-react/commit/c656c730acdd055e4f37d50e138389a818e2b3eb))
- support detached option for addSubscription ([0ed69e2](https://github.com/savageKarl/pinia-react/commit/0ed69e2a89c2c4ed5f29b63fb2f769539e473ee5))

# [1.5.0-beta.1](https://github.com/savageKarl/pinia-react/compare/v1.4.0...v1.5.0-beta.1) (2025-08-29)

### Features

- add docs ([c656c73](https://github.com/savageKarl/pinia-react/commit/c656c730acdd055e4f37d50e138389a818e2b3eb))
- support detached option for addSubscription ([0ed69e2](https://github.com/savageKarl/pinia-react/commit/0ed69e2a89c2c4ed5f29b63fb2f769539e473ee5))

# [1.4.0](https://github.com/savageKarl/pinia-react/compare/v1.3.1...v1.4.0) (2025-08-20)

### Features

- support detached option for addSubscription ([f886ca2](https://github.com/savageKarl/pinia-react/commit/f886ca2b36d99d5d6496d119f6f41b3dd15d67d5))
- update package.json and add error log ([5bf5def](https://github.com/savageKarl/pinia-react/commit/5bf5defb650ea18249cd0219b46d03d480622a96))

## [1.3.1](https://github.com/savageKarl/pinia-react/compare/v1.3.0...v1.3.1) (2025-08-17)

### Bug Fixes

- external all deps ([c724a4b](https://github.com/savageKarl/pinia-react/commit/c724a4bb80bb15b1bba5f81166584d382abd457e))
- remove comment ([8ce213d](https://github.com/savageKarl/pinia-react/commit/8ce213dfb60b531b588a152b917dd5a38437fe33))

# [1.3.0](https://github.com/savageKarl/pinia-react/compare/v1.2.1...v1.3.0) (2025-08-17)

### Features

- rewrite everyting and support new feature ([91f85da](https://github.com/savageKarl/pinia-react/commit/91f85da603cf0065ade1894af411932d7f722b6d))

## [1.2.1](https://github.com/savageKarl/pinia-react/compare/v1.2.0...v1.2.1) (2025-08-14)

### Bug Fixes

- resolve infinite loop in nextjs ([c77b064](https://github.com/savageKarl/pinia-react/commit/c77b064f78fb30177439c0f7672bb7e9aa16dfe3))

# [1.2.0](https://github.com/savageKarl/pinia-react/compare/v1.1.2...v1.2.0) (2025-08-13)

### Features

- add $getStore api ([1217330](https://github.com/savageKarl/pinia-react/commit/121733016bb974ed15a633a7c16506a33829d955))

## [1.1.2](https://github.com/savageKarl/pinia-react/compare/v1.1.1...v1.1.2) (2025-08-13)

### Bug Fixes

- resolve render error ([60aa5c6](https://github.com/savageKarl/pinia-react/commit/60aa5c6481593d069c99c3cca42a0b7c5ec30d71))
- resolve this error and render multiple ([08b1c85](https://github.com/savageKarl/pinia-react/commit/08b1c85152dba8e78efa97a1175add110036c11e))

## [1.1.1](https://github.com/savageKarl/pinia-react/compare/v1.1.0...v1.1.1) (2025-08-11)

### Bug Fixes

- external react deps ([139ada9](https://github.com/savageKarl/pinia-react/commit/139ada99a209baca5fc871d68ede0172c15fa3bd))

# [1.1.0](https://github.com/savageKarl/pinia-react/compare/v1.0.0...v1.1.0) (2025-08-11)

### Features

- complete basic feature ([0c40e77](https://github.com/savageKarl/pinia-react/commit/0c40e77dc78cd3baf6fca903275442d76035ddcb))

# 1.0.0 (2025-08-11)

### Features

- add readme ([df46e8f](https://github.com/savageKarl/pinia-react/commit/df46e8f5f818a96a35e7150de305d7e0905849c2))
- add simple-git-hooks config ([05facac](https://github.com/savageKarl/pinia-react/commit/05facac1a7b5f1bec7aa43ad5b23afc68a13cb6f))
- complete basic feature ([f2a1f91](https://github.com/savageKarl/pinia-react/commit/f2a1f9176742451b08ecae5f1b9c8107787152ad))
- use biome to lint and format code ([a7b84b8](https://github.com/savageKarl/pinia-react/commit/a7b84b8ad6b285b39cadbcb34e6b5f69a31078d1))
