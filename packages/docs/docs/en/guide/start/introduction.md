# Introduction

pinia-react is a React state management library inspired by Vue's [Pinia](https://github.com/vuejs/pinia). It's built upon Pinia's core code and leverages React Hooks and `useSyncExternalStore` to provide a concise, reactive, and TypeScript-friendly state management experience.

It's a React adaptation of [Pinia](https://github.com/vuejs/pinia), based on a portion of Pinia's core code and optimized for the React ecosystem (e.g., using `useSyncExternalStore` to support React 18's concurrent rendering). We strictly adhere to Pinia's MIT license and have retained the original author's copyright information in the license file.

## Why You Should Use Pinia-React

Pinia-React, as the React adaptation of Pinia, allows you to share state across components or pages. It automatically tracks state dependencies and only updates the necessary components. It's important to note that components don't re-render just because the store's data changes; it collects dependencies on-demand. For example, if a store has two pieces of data, `count` and `name`, and your component only uses `count`, then your component will only re-render when `count` changes.

## Basic Example

Here's a basic example of the Pinia API (to continue reading this introduction, please make sure you've already read the [Getting Started](https://www.google.com/search?q=./getting-started.md) section). First, you can create a Store:

```tsx
// stores/counter.js
import { defineStore } from 'pinia-react'

export const useCounterStore = defineStore('counter', {
  state: () => {
    return { count: 0 }
  },
  // You can also define it like this
  // state: () => ({ count: 0 })
  actions: {
    increment() {
      this.count++
    },
  },
})
```

Then, you can **use** the store in a component:

```tsx
export function App() {

  const store = useCounterStore()
  counter.count++
  // Autocomplete! ✨
  counter.$patch({ count: counter.count + 1 })
  // Or use an action instead
  counter.increment()

  return (
    <div>Current Count: {{ counter.count }}</div>
  )
}
```

-----

## Differences from Pinia

  - Pinia-React only supports the **options store style** and does not have the setup store style.
  - There is currently no test utility suite.
  - There is currently no Devtools support.
  - There is currently no hot reloading support.
  - There are no Vue-specific helper functions for mapping state.

-----

## Comparison

There is a wide variety of React state management libraries, each with its own strengths. Pinia-React is one of them. Here, we'll mainly compare it with Zustand. For Redux, Valtio, Jotai, and Recoil, you can refer to the Zustand [documentation](https://www.google.com/search?q=https://zustand.docs.pmnd.rs/getting-started/comparison%23render-optimization-\(vs-redux\)).

### State Model

Pinia-React and Zustand take fundamentally different approaches to state management. Pinia-React is based on a **mutable state model**, while Zustand is based on an **immutable state model**.

### Pinia-React

```tsx
import { defineStore, createPinia } from 'pinia-react';

// Use this in your entry file.
const pinia = createPinia();

export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  actions: {
    increment() {
      this.count++;
    },
    decrement() {
      this.count--;
    },
  },
});
```

### Zustand

```tsx
import { create } from 'zustand';

interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useCounterStoreZustand = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));
```

### Render Optimization

Another difference between Pinia-React and Zustand is that Pinia-React automatically collects dependencies for render optimization, whereas Zustand requires you to manually select dependencies for render optimization using selectors.

### Pinia-React

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function CounterWithPinia() {
  const counter = useCounterStore();

  return (
    <div>
      <h2>Pinia-React Count: {counter.count}</h2>
      <button onClick={() => counter.increment()}>Increase</button>
      <button onClick={() => counter.decrement()}>Decrease</button>
    </div>
  );
}
```

### Zustand

```tsx
import React from 'react';
import { useCounterStoreZustand } from './counterStore';

export function CounterWithZustand() {
  const count = useCounterStoreZustand((state) => state.count);
  const increment = useCounterStoreZustand((state) => state.increment);
  const decrement = useCounterStoreZustand((state) => state.decrement);

  return (
    <div>
      <h2>Zustand Count: {count}</h2>
      <button onClick={increment}>Increase</button>
      <button onClick={decrement}>Decrease</button>
    </div>
  );
}
```