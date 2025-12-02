# Defining a Store

A Store is defined using `defineStore()`. Its first parameter is a unique ID that Pinia uses to identify the store.

```tsx
import { defineStore } from 'pinia-react'

// `defineStore()` returns an object containing `useStore` and `getStore`.
// It's a common pattern to export them for use throughout your application.
const { useStore, getStore } = defineStore('alerts', {
  // Other configurations...
})

export const useAlertsStore = useStore
export const getAlertsStore = getStore
```

It's recommended to name the exported hook starting with `use` and ending with `Store` (e.g., `useUserStore`, `useCartStore`). This follows standard React Hook conventions.

## Option Store

You define a store's configuration by passing an options object with `state`, `getters`, and `actions` properties.

```tsx
export const { useStore: useCounterStore, getStore: getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0, name: 'Eduardo' }),
  getters: {
    doubleCount: (state) => state.count * 2,
  },
  actions: {
    increment() {
      this.count++
    },
  },
})
```

## Using the Store

After defining the store, simply import and call its hook in your component.

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function App() {
  const counter = useCounterStore();

  return (
    <div>
      <h2>Pinia-React Count: {counter.count}</h2>
    </div>
  );
}
```