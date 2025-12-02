# pinia-react

`pinia-react` is a lightweight, type-safe state management library for React. It combines the developer experience of Pinia (Vue) with the power of **Immer** and **React Hooks**.

Key features:
- **Reactive**: Built on `useSyncExternalStore` for concurrent rendering support.
- **Efficient**: Fine-grained dependency tracking. Components only re-render when used properties change.
- **Intuitive**: Write actions with mutable syntax (thanks to Immer) but get immutable state updates.
- **DevTools**: Integrated with Redux DevTools Extension.

## Installation

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

`defineStore` returns an object containing hooks and getters.

```ts
// src/stores/counter.ts
import { defineStore } from 'pinia-react'

// Return value is { useStore, getStore }
export const counterStoreDefinition = defineStore('counter', {
  // State: Initial state factory
  state: () => ({
    count: 0,
    name: 'Pinia'
  }),

  // Getters: Computed values
  getters: {
    doubleCount() {
      // `this` refers to the store instance
      return this.count * 2
    }
  },

  // Actions: Methods to modify state
  actions: {
    increment() {
      // `this` is an Immer draft, so you can mutate it directly!
      this.count++
    },
    async renameAsync(newName: string) {
      // Async is supported
      await new Promise(r => setTimeout(r, 500))
      this.name = newName
    }
  }
})

// Export the hook for convenience
export const useCounterStore = counterStoreDefinition.useStore
```

### 3. Use in Components

```tsx
import { useCounterStore } from '../stores/counter'

export function Counter() {
  // The store object is a Proxy that tracks property access
  const store = useCounterStore()

  return (
    <div>
      {/* Re-renders ONLY when count changes */}
      <p>Count: {store.count}</p>
      
      {/* Re-renders ONLY when doubleCount changes */}
      <p>Double: {store.doubleCount}</p>

      {/* Trigger actions */}
      <button onClick={() => store.increment()}>+1</button>
      
      {/* ⚠️ Store properties are Read-Only in components. 
          store.count++ // This will warn and fail. 
          Use actions or $patch instead. 
      */}
    </div>
  )
}
```

## Core API

### `$patch`

Allows you to update multiple state properties at once using a callback function. The callback receives an Immer draft.

> **Note**: Unlike Vue's Pinia, this implementation only accepts a callback function, not an object.

```ts
const store = useCounterStore()

store.$patch((state) => {
  state.count += 10
  state.name = 'Patched'
})
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

### `getStore` (Usage Outside Components)

If you need to access the store outside of a React Component (e.g., in a utility function or router), use `getStore`.

```ts
import { counterStoreDefinition } from './stores/counter'

function logCount() {
  // Retrieves the active store instance without using Hooks
  const store = counterStoreDefinition.getStore()
  console.log(store.count)
}
```

## TypeScript

Types are inferred automatically. No extra configuration is needed.

```ts
type CounterState = { count: number }

export const useStore = defineStore('id', {
  state: (): CounterState => ({ count: 0 }),
  // ...
}).useStore
```

## Documentation

To learn more about Pinia-React, check [its documentation](https://savagekarl.github.io/pinia-react).

## License

MIT
