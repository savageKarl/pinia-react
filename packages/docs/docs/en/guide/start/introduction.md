# Introduction

Pinia-React is a React state management library inspired by Vue's [Pinia](https://github.com/vuejs/pinia). It organizes shared state through State, Getters, and Actions, and connects to React through `useSyncExternalStore`.

## Why You Should Use Pinia-React

Pinia-React tracks the state a component reads during rendering. For example, if a Store contains `count` and `name` but a component only reads `count`, changing `name` does not notify that component through its Store subscription.

## When should you use a Store?

Use a Store for data shared across components or pages, such as a theme or login state. Components on a complex page can also share state and business logic through a Store. Components read data and call Actions; Store logic can be tested without rendering components.

Keep state in a component when it has no sharing requirements. It does not need a Store.

## Basic Example

[Quick Start](./getting-started.mdx) contains a complete counter example, from installation and initialization to defining and using a Store.

## Differences from Pinia

  - Pinia-React only supports the **options store style** and does not have the setup store style.
  - Pinia-React can integrate with Redux DevTools through the optional `@pinia-react/devtools` plugin.
  - There is currently no test utility suite.
  - There is currently no hot reloading support.
  - There are no Vue-specific helper functions for mapping state.

## Comparison

There is a wide variety of React state management libraries. Here, we'll mainly compare it with Zustand, a popular choice in the ecosystem.

### State Update Model

The examples below compare how the two libraries update immutable state.

- **Pinia-React** uses Immer. Writes such as `this.count++` inside Actions produce new immutable state.

- **Zustand** uses a **functional update API**. You must explicitly return a new state object inside the `set` function, manually handling immutability with techniques like the spread syntax (`...state`).

### Pinia-React

```tsx
import { defineStore } from 'pinia-react';

export const { useCounterStore, getCounterStore } = defineStore('counter', {
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
