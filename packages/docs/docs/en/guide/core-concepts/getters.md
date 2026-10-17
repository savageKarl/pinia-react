# Getters

Getters compute values from State or other Getters. Results are cached and recomputed when their dependencies change.

Define Getters in the `getters` option of `defineStore()`. The first argument is the current Store's `state`.

```tsx
export const { useCounterStore, getCounterStore } = defineStore('counter', {
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
export const { useCounterStore, getCounterStore } = defineStore('counter', {
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

Call the other Store's `getOtherStore()` inside a Getter, then read the property you need. Do not call a React Hook there. The generic `getStore()` alias is also available.

```tsx
import { getOtherStore } from './other-store'

export const { useMainStore, getMainStore } = defineStore('main', {
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
