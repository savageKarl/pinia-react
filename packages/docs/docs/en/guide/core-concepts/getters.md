# Getters

Getters are functions that compute derived state from your Store's state.

**Concept Explanation:**

*   **Computed Values:** Think of them as computed properties for your store. They are useful for calculating data that depends on other state properties.
*   **Cached:** Getters are cached. They will only re-evaluate when one of their dependencies (a state property or another getter) has changed, which improves performance.

Define getters using the `getters` property in `defineStore()`. They receive `state` as their first argument.

```tsx
export const { useStore: useCounterStore } = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount: (state) => state.count * 2,
  },
})
```

## Accessing Other Getters

To use other getters within a getter, you can use a regular function and access other store properties via `this`. In TypeScript, you **must** explicitly define the return type for this to work.

```tsx
export const { useStore: useCounterStore } = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount(state) {
      return state.count * 2
    },
    // The return type **must** be explicitly set here
    doublePlusOne(): number {
      // Autocomplete and type annotation for `this` ✨
      return this.doubleCount + 1
    },
  },
})
```

Then you can directly access the getter on the store instance in your components:

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function CounterComponent() {
  const counter = useCounterStore();

  return (
    <p>Double count is {counter.doubleCount}</p>
  );
}
```

## Accessing Getters from Other Stores

To use a getter from another store, get that store's instance and use it. Remember to use the `getStore` function for use cases outside of React components, like inside another store's logic.

```tsx
import { getOtherStore } from './other-store'

export const { useStore: useMainStore } = defineStore('main', {
  state: () => ({
    localData: 'hello'
  }),
  getters: {
    combinedData(state): string {
      const otherStore = getOtherStore()
      return state.localData + ' ' + otherStore.data
    },
  },
})
```