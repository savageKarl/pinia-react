---
"pinia-react": major
---

## **Changelog: Pinia-React Library Major Refactor & API Redesign**

This release represents a fundamental rewrite, moving from a Vue-inspired reactivity model to a more modern, React-idiomatic architecture using Immer and `useSyncExternalStore`. This results in significant breaking changes but offers improved performance, enforced predictability, and a better developer experience within the React ecosystem.

### 💥 Major Breaking Changes (API & Usage)

*   **`defineStore` Return Value Changed**:
    *   **Before**: `defineStore` returned a single function, `useStore`, which also had `$id` and `$getStore` properties attached to it.
        ```javascript
        // Old way
        export const useCounterStore = defineStore(...)
        // In component: useCounterStore()
        // Outside component: useCounterStore.$getStore()
        ```
    *   **After**: `defineStore` now returns an object containing two separate functions: `{ useStore, getStore }`.
        ```javascript
        // New way
        export const { useStore: useCounterStore, getStore: getCounterStore } = defineStore(...)
        // In component: useCounterStore()
        // Outside component: getCounterStore()
        ```
*   **`$patch` API Signature Change**:
    *   **Before**: The `$patch` method was overloaded, accepting either a partial state object or a mutator function.
        ```javascript
        // Old way
        store.$patch({ count: store.count + 1 }) // Object form
        store.$patch(state => state.count++)     // Function form
        ```
    *   **After**: The `$patch` method **only accepts a single function** that receives an Immer `draft` object. The object-based patch has been removed.
        ```javascript
        // New way
        store.$patch(draft => {
          draft.count++
        })
        ```
*   **Enforced State Immutability**:
    *   **Before**: The store's state was a `reactive` object from `@maoism/runtime-core`. You could directly mutate state from anywhere (e.g., `store.count++`).
    *   **After**: The store instance is a Proxy that makes top-level state properties read-only outside of actions. Attempting to mutate state directly (e.g., `store.count++`) will now result in a console warning. All mutations **must** occur within an `action` or via `$patch`. This enforces a unidirectional data flow.
*   **Removal of `$onAction`**:
    *   The `$onAction()` API for middleware-style listening to action calls has been completely removed. This functionality should now be handled by the plugin system for more robust and centralized logic.

### ✨ Core Architecture & Feature Enhancements

*   **Reactivity System Overhaul**:
    *   The entire reactivity core based on `@maoism/runtime-core` (`ref`, `computed`, `reactive`, `effectScope`, `watch`) has been **completely removed**.
    *   The new foundation is **Immer** for safe, immutable state updates and **`useSyncExternalStore`** for component subscriptions. This is the official, recommended approach for external stores in React 18, preventing tearing and ensuring concurrent rendering safety.
*   **Performance via Fine-Grained Subscriptions**:
    *   The `useStore` hook now tracks dependencies at the property level (e.g., `store.user.name`). A component will only re-render if a state property or getter it specifically accessed during render is affected by a state update. This is a major performance boost, preventing unnecessary renders.
*   **Advanced Getter System**:
    *   Getters now feature a robust, custom-built dependency tracking system, free from the old `computed` dependency.
    *   **Cross-Store Dependencies**: Getters in `StoreA` can now safely access state or other getters from `StoreB`. The library automatically establishes a subscription, ensuring `StoreA`'s getter is invalidated and recalculated when its dependency in `StoreB` changes.
    *   **Circular Dependency Detection**: The system now detects and warns about circular dependencies within getters.
*   **Improved Redux DevTools Integration**:
    *   The integration is now more explicit and powerful, correctly handling time-travel features like `JUMP_TO_STATE`, `JUMP_TO_ACTION`, `ROLLBACK`, `COMMIT`, and `RESET` for a significantly improved debugging workflow.

### 🗑️ Removals & Simplifications

*   **Removed Files**: The utility files `subscription.ts` and `utils.ts` have been removed, with their logic being either replaced by Immer or consolidated into `store.ts`.
*   **Removed `MutationType` Enum**: The `MutationType` enum and associated complex subscription types have been removed. The new `$subscribe` callback is simpler, providing only the new and previous state: `(state, prevState) => void`.

### 📝 Type System Overhaul

*   **Vue-related Types Removed**: All types from `@maoism/runtime-core` (e.g., `Ref`, `UnwrapRef`, `ComputedRef`, `_GettersTree`, `_ActionsTree`) have been eliminated.
*   **Immer Types Introduced**: Core types now include `Draft` and `Patch` from Immer.
*   **New `StoreScope` Type**: A new `StoreScope` interface encapsulates the entire state of a store instance (`currentState`, `listeners`, `getterCache`, `getterDependencies`, etc.), simplifying the internal architecture. The global `pinia._scopes` map holds these scopes.
*   **Simplified Public Types**: The overall type surface area is greatly reduced, making the library easier to understand, extend, and maintain.
