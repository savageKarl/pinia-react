# Getter

 Getters are functions used to calculate or derive new data from the State.

**Concept Explanation:**
* **Read-only:** Getters are only used to retrieve data and should not directly modify the State.
* **Dependency Tracking:** A Getter will only recalculate when the State data it depends on changes. This avoids unnecessary repeated calculations and improves performance.

You can define them through the getters property in defineStore(). Arrow functions are recommended, and they will receive state as the first parameter:

```tsx
export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount: (state) => state.count * 2,
  },
})
```

Most of the time, getters only depend on the state. However, sometimes they may also use other getters. Therefore, even when defining a getter using a regular function, we can access the entire store instance through this, but (in TypeScript) we must define the return type. This is to avoid known TypeScript limitations, but it does not affect getters defined with arrow functions or getters that do not use this.

```tsx
export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    // The return type is automatically inferred as a number
    doubleCount(state) {
      return state.count * 2
    },
    // The return type **must** be explicitly set
    doublePlusOne(): number {
      // Auto-completion and type annotation for the entire store ✨
      return this.doubleCount + 1
    },
  },
})
```

Then you can directly access the getter on the store instance:

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function CounterWithPinia() {
  const counter = useCounterStore();

  return (
    <p>Double count is {{ store.doubleCount }}</p>
  );
}
```


## Accessing Other Getters 

You can also combine multiple getters. Through this, you can access any other getter. In this case, you need to specify a return type for this getter.

```tsx
export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount(state) {
      return state.count * 2
    },
    doubleCountPlusOne(): number {
      return this.doubleCount + 1
    },
  },
})
```

## Accessing Getters from Other Stores 

To use a getter from another store, simply use it directly inside the getter:

```tsx
import { useOtherStore } from './other-store'

export const useStore = defineStore('main', {
  state: () => ({
    // ...
  }),
  getters: {
    otherGetter(state) {
      const otherStore = useOtherStore.$getStore()
      return state.localData + otherStore.data
    },
  },
})
```