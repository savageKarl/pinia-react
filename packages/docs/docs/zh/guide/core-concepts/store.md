# 定义 Store

Store 使用 `defineStore()` 进行定义。它的第一个参数是一个唯一的 ID，Pinia 使用它来标识这个 Store。

```tsx
import { defineStore } from 'pinia-react'

// `defineStore()` 会根据 Store ID 自动生成命名函数。
// 对于 `alerts`，生成的函数是 `useAlertsStore` 和 `getAlertsStore`。
const { useAlertsStore, getAlertsStore } = defineStore('alerts', {
  // 其他配置...
})

```

按照惯例，建议导出的 Hook 名称以 `use` 开头并以 `Store` 结尾（例如 `useUserStore`, `useCartStore`）。这符合 React Hooks 的命名规范。

## Option Store (选项式 Store)

你需要通过传递一个包含 `state`、`getters` 和 `actions` 属性的选项对象来定义 Store 的配置。

```tsx
export const { useCounterStore, getCounterStore } = defineStore('counter', {
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

## 使用 Store

定义好 Store 后，只需在组件中导入并调用对应的 Hook 即可。

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function App() {
  const counter = useCounterStore();

  return (
    <div>
      <h2>Pinia-React Count: {counter.count}</h2>
    </div>
  );
}
```
