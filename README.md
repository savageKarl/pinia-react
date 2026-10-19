# pinia-react

`pinia-react` is a structured, type-safe Store for React applications. It organizes shared business state into State, Getters, and Actions, then connects that Store to React through `useSyncExternalStore`.

Choose Pinia-React when your application benefits from explicit Store boundaries, named derived values, action lifecycles, and plugins that work consistently from components and ordinary TypeScript code.

Key features:
- **Structured**: State, Getters, and Actions give shared business logic a predictable home.
- **React-compatible**: Built on `useSyncExternalStore` for React 18 and 19 rendering semantics.
- **Automatic dependency tracking**: Store reads during render are tracked by path, so unrelated committed fields do not notify that component's Store subscription.
- **Immer actions**: Write Action updates with mutable syntax and receive immutable state transitions.
- **Optional integrations**: Persistence and Redux DevTools are separate packages with documented browser and SSR boundaries.

Automatic tracking filters Store subscription updates. Parent updates, props, Strict Mode, or concurrent work can still cause React to render a component.

## Installation

Requires React 18 or 19.

```bash
pnpm add pinia-react
```

## Quick Start

### 1. Initialize Pinia

Call `createPinia()` once in your application entry point to initialize the global store registry.

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createPinia } from 'pinia-react'
import App from './App'

// ⚠️ Required: Initialize the global pinia instance before rendering
createPinia()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### 2. Define a Store

`defineStore` returns an object containing the default `useStore` and `getStore` helpers, as well as named helpers generated from the store ID.

```ts
// src/stores/counter.ts
import { defineStore } from 'pinia-react'

// `defineStore('counter')` also provides `useCounterStore` and `getCounterStore`
export const { useCounterStore, getCounterStore } = defineStore('counter', {
  // State: Initial state factory
  state: () => ({
    count: 0,
    name: 'Pinia'
  }),

  // Getters: Computed values
  getters: {
    doubleCount(): number {
      // `this` refers to the store instance
      return this.count * 2
    }
  },

  // Actions: Methods to modify state
  actions: {
    increment() {
      // Action writes use Immer to commit immutable updates.
      this.count++
    },
    async renameAsync(newName: string) {
      // Async is supported
      await new Promise(r => setTimeout(r, 500))
      this.name = newName
    }
  }
})

```

### 3. Use in Components

```tsx
import { useCounterStore } from '../stores/counter'

export function Counter() {
  // The store object is a Proxy that tracks property access
  const store = useCounterStore()

  return (
    <div>
      {/* The Store subscription tracks the paths read during this render. */}
      <p>Count: {store.count}</p>

      {/* Getter value derived from the current count. */}
      <p>Double: {store.doubleCount}</p>

      {/* Trigger actions */}
      <button onClick={() => store.increment()}>+1</button>

      {/* ⚠️ Store properties are Read-Only in components.
          store.count++ // This is read-only in components.
          Use an Action or $patch instead.
      */}
    </div>
  )
}
```

## Core API

### `$patch`

Allows you to update multiple state properties at once. Use a callback for Immer draft updates or a shallow object for top-level replacements.

```ts
const store = getCounterStore()

store.$patch((state) => {
  state.count += 10
  state.name = 'Patched'
})

store.$patch({ count: 10, name: 'Patched' })
```

### `$reset`

Resets the store state to its initial value (defined in the `state` function).

```ts
store.$reset()
```

### `$subscribe`

Listen to state changes manually.

```ts
useEffect(() => {
  const unsubscribe = store.$subscribe((newState, oldState) => {
    console.log('State changed:', newState)
  })
  return unsubscribe
}, [store])
```

### Named `getXxxStore` Helpers (Usage Outside Components)

If you need to access the store outside of a React Component (e.g., in a utility function or router), use the named `getXxxStore` helper generated from the store ID.

```ts
import { getCounterStore } from './stores/counter'

function logCount() {
  // Retrieves the active store instance without using Hooks
  const store = getCounterStore()
  console.log(store.count)
}
```

With multiple instances, pass the intended Pinia to `getCounterStore(pinia)`; React components use the nearest `PiniaProvider`. See [usage outside components](https://savagekarl.github.io/pinia-react/guide/core-concepts/outside-component-usage) for setup.

## TypeScript

Types are inferred automatically. No extra configuration is needed.

```ts
type CounterState = { count: number }

export const { useIdStore, getIdStore } = defineStore('id', {
  state: (): CounterState => ({ count: 0 }),
  // ...
})
```

## DevTools

DevTools support is provided by the optional `@pinia-react/devtools` package. It integrates opted-in stores with the Redux DevTools Extension; it is not a Vue Devtools integration.

```bash
pnpm add -D @pinia-react/devtools
```

Register the plugin before any store is created, then enable the stores you want to inspect:

```ts
import { createPinia, defineStore } from 'pinia-react'
import { devtoolsPlugin } from '@pinia-react/devtools'

const pinia = createPinia()
pinia.use(devtoolsPlugin({ name: 'My App' }))

export const { useCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  devtools: {
    enabled: true,
    name: 'Counter'
  }
})
```

The plugin reports actions, `$patch()` calls, and `$reset()` calls. Redux DevTools can inspect state and perform jump, rollback, reset, commit, and state import operations. See the [DevTools guide](https://savagekarl.github.io/pinia-react/guide/plugins/devtools) for configuration and limitations.

## Persisted State

Install `@pinia-react/persistedstate` and register its default plugin before stores are created. Enable a store with `persist: true`, or configure global defaults, `auto`, custom keys, synchronous storage, nested `pick` / `omit`, hooks and ordered strategies through `createPersistedState`. In a browser React SPA, `PiniaProvider` accepts initialization-only `plugins={[persistedState]}`.

```bash
pnpm add @pinia-react/persistedstate
```

```ts
import { createPinia, defineStore } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'

createPinia().use(persistedState)

export const { usePreferencesStore } = defineStore('preferences', {
  state: () => ({ theme: 'light' }),
  persist: true
})
```

Manual `$hydrate?.()` / `$persist?.()` methods are present only on enabled stores. For server-rendered App Router preferences, use the separate `@pinia-react/persistedstate/next` Cookie adapter with an allowlisted request snapshot; the default localStorage plugin remains SPA-only. See the [persisted state guide](https://savagekarl.github.io/pinia-react/guide/plugins/persistedstate) for setup, API and security limits.

## Examples

The repository includes these runnable examples:

| Example | Where to find it |
| --- | --- |
| Basic Store, Getter, Action, and async updates | React Playground `#counter` and `#comparison`; [Actions guide](https://savagekarl.github.io/pinia-react/guide/core-concepts/actions) |
| Shared state | React Playground `#sharing` |
| SSR snapshots and hydration | Next.js Playground; [Next.js guide](https://savagekarl.github.io/pinia-react/guide/integrations/nextjs) |
| Browser persistence | React Playground `#persistence`; [persistence guide](https://savagekarl.github.io/pinia-react/guide/plugins/persistedstate) |
| DevTools | Redux DevTools Extension with the React Playground; [DevTools guide](https://savagekarl.github.io/pinia-react/guide/plugins/devtools) |
| Zustand comparison | React Playground `#comparison`; [comparison guide](https://savagekarl.github.io/pinia-react/guide/integrations/compare-zustand) |

Comparison render counts are illustrative, not a speed score.

```bash
pnpm install
pnpm playground-react
pnpm playground-nextjs
```

For development commands and contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Documentation

To learn more about Pinia-React, check [its documentation](https://savagekarl.github.io/pinia-react).

## License

MIT
