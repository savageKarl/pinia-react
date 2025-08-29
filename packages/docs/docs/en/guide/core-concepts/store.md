# Defining a Store

Before diving into core concepts, we need to know that a Store is defined using defineStore(), and its first parameter requires a unique name:

```tsx
import { defineStore } from 'pinia-react'

//  The naming of the return value of `defineStore()` is free
// but it's best to include the store name and start with `use` and end with `Store`.
// (like `useUserStore`, `useCartStore`, `useProductStore`)
// The first parameter is the unique ID of the Store in your application.
export const useAlertsStore = defineStore('alerts', {
  // Other configurations...
})
```

This name, which is also used as an id, must be passed in. Pinia will use it to connect to the store. To form a habit, name the returned function as use..., because it returns a hook.

## Option Store 

Pass in an Option object with state, actions, and getters properties


```tsx
export const useCounterStore = defineStore('counter', {
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

After defining the store, simply import and use it in your component.

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function App() {
  // You can access the variable `store` anywhere inside the component ✨
  const counter = useCounterStore();

  return (
    <div>
      <h2>Pinia-React Count: {counter.count}</h2>
    </div>
  );
}
```
```