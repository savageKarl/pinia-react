# 简介

pinia-react 是一个受 Vue 的 [Pinia](https://github.com/vuejs/pinia) 启发的 React 状态管理库，基于 Pinia 的核心代码实现，结合 React Hooks 和 `useSyncExternalStore`，提供简洁、响应式、TypeScript 友好的状态管理体验。

它是 [Pinia](https://github.com/vuejs/pinia) 的 React 适配版本，基于 Pinia 的部分核心代码实现，并针对 React 生态进行了优化（例如使用 `useSyncExternalStore` 支持 React 18 的并发渲染）。我们严格遵守 Pinia 的 MIT 许可证，并在许可证文件中保留了原作者的版权信息。


## 为什么你应该使用 Pinia-React？

Pinia-React 是 Pinia 的 React 适配版本，它允许你跨组件或页面共享状态。它会自动追踪状态依赖，仅更新必要组件。注意，并不是 store 的数据变化时，使用到的组件就会变化，它是按需收集依赖的，例如：一个 store 里面有 count 和 name 两个数据，如果你的组件仅用到了 count，那么只有 count 变化时，你的组件才会重新渲染。


## 基础示例

下面就是 pinia API 的基本用法 (为继续阅读本简介请确保你已阅读过了[开始](./getting-started.md)章节)。你可以先创建一个 Store：

```tsx
// stores/counter.js
import { defineStore } from 'pinia-react'

export const useCounterStore = defineStore('counter', {
  state: () => {
    return { count: 0 }
  },
  // 也可以这样定义
  // state: () => ({ count: 0 })
  actions: {
    increment() {
      this.count++
    },
  },
})
```

然后你就可以在一个组件中**使用**该 store 了：

```tsx
export function App() {

  const store = useCounterStore()
  counter.count++
  // 自动补全！ ✨
  counter.$patch({ count: counter.count + 1 })
  // 或使用 action 代替
  counter.increment()

  return (
    <div>Current Count: {{ counter.count }}</div>
  )
}
```

## 与 Pinia 区别

- pinia-react 只有 options store 风格写法，没有 setup store 风格写法
- 暂时没有测试工具集
- 暂时没有 Devtools 支持
- 暂时没有热更新支持
- 没有 vue 生态专属的 映射 state 的辅助函数


## 比较

React 状态管理库种类繁多，各有千秋，Pinia-React 作为其中之一。在这里，主要与 Zustand 进行比较，关于 Redux、Valtio、Jotai 和 Recoil，可以参考 Zustand [文档](https://zustand.docs.pmnd.rs/getting-started/comparison#render-optimization-(vs-redux))


### 状态模型

Pinia-React 和 Zustand 在状态管理方面采取了根本不同的方法。Pinia-React 基于可变状态模型，而 Zustand 基于不可变状态模型 。

### Pinia-React

```tsx
import { defineStore, createPinia } from 'pinia-react';

// 在入口文件使用即可。
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


### 渲染优化

Pinia-React 和 Zustand 另一个不同之处在于，Pinia-React 会自动收集依赖进行渲染优化，而 Zustand 需要通过选择器手动选择依赖进行渲染优化。

### Pinia-React

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

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