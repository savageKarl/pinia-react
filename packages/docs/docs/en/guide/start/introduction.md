
# Introduction

pinia-react is a React state management library inspired by Vue's [Pinia](https://github.com/vuejs/pinia). It leverages React Hooks and `useSyncExternalStore` to provide a concise, reactive, and TypeScript-friendly state management experience.

It's a React adaptation of Pinia, built with similar core concepts but optimized for the React ecosystem (e.g., using `useSyncExternalStore` to support React 18's concurrent rendering).

## Why You Should Use Pinia-React

Pinia-React allows you to share state across components or pages. It automatically tracks state dependencies and only updates the necessary components. It's important to note that components don't re-render just because the store's data changes; it collects dependencies on-demand. For example, if a store has two pieces of data, `count` and `name`, and your component only uses `count`, then your component will only re-render when `count` changes.

## Basic Example

Here's a basic example of the Pinia-React API (to continue reading this introduction, please make sure you've already read the [Getting Started](./getting-started.mdx) section). First, you can create a Store:

```tsx
// stores/counter.ts
import { defineStore } from 'pinia-react'

const { useStore, getStore } = defineStore('counter', {
  state: () => {
    return { count: 0 }
  },
  actions: {
    increment() {
      this.count++
    },
  },
})

export const useCounterStore = useStore
export const getCounterStore = getStore
```

Then, you can **use** the store in a component:

```tsx
import { useCounterStore } from './stores/counter';

export function App() {
  const counter = useCounterStore()

  return (
    <div>
      <p>Current Count: {counter.count}</p>
      <button onClick={() => counter.increment()}>Increment</button>
    </div>
  )
}
```



## Differences from Pinia

  - Pinia-React only supports the **options store style** and does not have the setup store style.
  - Pinia-React has built-in support for Redux DevTools.
  - There is currently no test utility suite.
  - There is currently no hot reloading support.
  - There are no Vue-specific helper functions for mapping state.



## Comparison

There is a wide variety of React state management libraries. Here, we'll mainly compare it with Zustand, a popular choice in the ecosystem.

### State Update Model

Both Pinia-React and Zustand use an **immutable state model**, which is a best practice for predictable state management. The key difference lies in their API philosophy for achieving immutability.

- **Pinia-React** uses Immer under the hood, providing a **direct-mutation-style API**. You write simple, intuitive code like `this.count++`, and the library transparently handles the creation of a new, immutable state object for you. This simplifies development, especially for complex or nested state updates.

- **Zustand** uses a **functional update API**. You must explicitly return a new state object inside the `set` function, manually handling immutability with techniques like the spread syntax (`...state`).

### Pinia-React

```tsx
import { defineStore } from 'pinia-react';

const { useStore } = defineStore('counter', {
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

export const useCounterStore = useStore;
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

- **Pinia-React** provides **automatic and transparent** render optimization. It tracks which properties are accessed during a component's render and will only trigger a re-render if one of those specific properties changes.

- **Zustand** requires **manual render optimization** via selectors. To prevent re-renders from unrelated state changes, you must explicitly select the pieces of state your component needs.

### Pinia-React

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

// This component automatically subscribes only to `count`.
// It will NOT re-render if another state property (e.g., `name`) changes.
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

// To optimize renders, we must select each piece of state or action individually.
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