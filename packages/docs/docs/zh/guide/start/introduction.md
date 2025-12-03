# 简介

pinia-react 是一个深受 Vue [Pinia](https://github.com/vuejs/pinia) 启发的 React 状态管理库。它利用 React Hooks 和 `useSyncExternalStore` 提供了一种简洁、响应式且对 TypeScript 友好的状态管理体验。

它是 Pinia 的 React 改版，构建在相似的核心概念之上，但针对 React 生态系统进行了优化（例如，使用 `useSyncExternalStore` 以支持 React 18 的并发渲染）。

## 为什么要使用 Pinia-React？

Pinia-React 允许你在组件或页面之间共享状态。它会自动追踪状态依赖，并且只更新必要的组件。需要注意的是，组件不会仅仅因为 Store 的数据变化而重新渲染；它是按需收集依赖的。例如，如果一个 Store 有两个数据 `count` 和 `name`，而你的组件只使用了 `count`，那么只有当 `count` 发生变化时，你的组件才会重新渲染。

## 基础示例

下面是 Pinia-React API 的一个基本示例（继续阅读本简介前，请确保你已经阅读了[快速开始](./getting-started.mdx)章节）。首先，你可以创建一个 Store：

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

然后，你可以在组件中**使用**这个 Store：

```tsx
import { useCounterStore } from './stores/counter';

export function App() {
  const counter = useCounterStore()

  return (
    <div>
      <p>当前计数: {counter.count}</p>
      <button onClick={() => counter.increment()}>增加</button>
    </div>
  )
}
```

## 与 Pinia 的区别

  - Pinia-React 仅支持 **Option Store（选项式）** 风格，没有 Setup Store 风格。
  - Pinia-React 内置了对 Redux DevTools 的支持。
  - 目前没有测试工具套件。
  - 目前不支持热重载（HMR）。
  - 没有用于映射状态（mapState 等）的 Vue 专用辅助函数。

## 对比

React 状态管理库种类繁多。在这里，我们主要将其与生态中流行的 Zustand 进行对比。

### 状态更新模式

Pinia-React 和 Zustand 都使用 **不可变状态（Immutable State）模式**，这是可预测状态管理的最佳实践。关键的区别在于它们实现不可变性的 API 理念。

- **Pinia-React** 底层使用 Immer，提供了一种**直接修改（Mutable）风格的 API**。你可以编写简单、直观的代码，如 `this.count++`，而库会透明地为你处理新不可变状态对象的创建。这大大简化了开发，尤其是对于复杂或嵌套状态的更新。

- **Zustand** 使用**函数式更新 API**。你必须在 `set` 函数中显式返回一个新的状态对象，并手动处理不可变性（例如使用 `...state` 展开语法）。

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

### 渲染优化

- **Pinia-React** 提供**自动且透明**的渲染优化。它会追踪组件在渲染期间访问了哪些属性，并且只有当这些特定属性发生变化时才会触发重新渲染。

- **Zustand** 需要通过选择器（Selectors）进行**手动渲染优化**。为了防止无关的状态变化导致重渲染，你必须显式选择组件需要的状态片段。

### Pinia-React

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

// 这个组件自动订阅且仅订阅 `count`。
// 如果其他状态属性（例如 `name`）发生变化，它**不会**重新渲染。
export function CounterWithPinia() {
  const counter = useCounterStore();

  return (
    <div>
      <h2>Pinia-React Count: {counter.count}</h2>
      <button onClick={() => counter.increment()}>增加</button>
      <button onClick={() => counter.decrement()}>减少</button>
    </div>
  );
}
```

### Zustand

```tsx
import React from 'react';
import { useCounterStoreZustand } from './counterStore';

// 为了优化渲染，我们必须单独选择每个状态片段或 Action。
export function CounterWithZustand() {
  const count = useCounterStoreZustand((state) => state.count);
  const increment = useCounterStoreZustand((state) => state.increment);
  const decrement = useCounterStoreZustand((state) => state.decrement);

  return (
    <div>
      <h2>Zustand Count: {count}</h2>
      <button onClick={increment}>增加</button>
      <button onClick={decrement}>减少</button>
    </div>
  );
}
```