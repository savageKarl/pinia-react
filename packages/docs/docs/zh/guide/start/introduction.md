# 简介

Pinia-React 是一个受 Vue [Pinia](https://github.com/vuejs/pinia) 启发的 React 状态管理库。它通过 State、Getter 和 Action 组织共享状态，并使用 `useSyncExternalStore` 接入 React。

## 为什么要使用 Pinia-React？

Pinia-React 会追踪组件在渲染时读取的状态。例如，Store 包含 `count` 和 `name`，组件只读取 `count` 时，修改 `name` 不会通过 Store 订阅触发该组件更新。

## 什么时候使用 Store？

主题、登录状态等多个组件或页面需要共享的数据适合放进 Store。复杂页面中需要协作的组件，也可以共享 Store 中的状态和业务逻辑。组件只负责读取数据和调用 Action；测试 Store 的逻辑时无需渲染组件。

只在单个组件内使用、没有共享需求的状态，可以保留在组件中，不必创建 Store。

## 基础示例

[快速开始](./getting-started.mdx)包含安装、初始化、定义 Store 和组件调用的完整计数器示例。

## 与 Pinia 的区别

  - Pinia-React 仅支持 **Option Store（选项式）** 风格，没有 Setup Store 风格。
  - Pinia-React 可通过可选的 `@pinia-react/devtools` 插件接入 Redux DevTools。
  - 目前没有测试工具套件。
  - 目前不支持热重载（HMR）。
  - 没有用于映射状态（mapState 等）的 Vue 专用辅助函数。

## 对比

React 状态管理库种类繁多。在这里，我们主要将其与生态中流行的 Zustand 进行对比。

### 状态更新模式

下面的示例对比两种库更新不可变状态的写法。

- **Pinia-React** 使用 Immer。Action 中的 `this.count++` 等修改会生成新的不可变状态。

- **Zustand** 使用**函数式更新 API**。你必须在 `set` 函数中显式返回一个新的状态对象，并手动处理不可变性（例如使用 `...state` 展开语法）。

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
