# 定义 Store

Store 使用 `defineStore()` 进行定义。它的第一个参数是一个唯一的 ID，Pinia 使用它来标识这个 Store。

在同一个 Pinia 实例内，Store ID 必须唯一。重复定义同一个 ID 会在开发时告警，并且新的定义会替换掉之前的 Store。

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

## Provider 实例解析

上面的解构式辅助函数继续作为主要 API。组件中的 useCounterStore() 优先读取 PiniaProvider Context，再回退到 activePinia。getCounterStore() 是普通函数，除 Getter 求值期间外读取当前 active 实例。Next.js 推荐使用一个根 Provider，并仅在 Client Component 调用 Hook，详见 [Next.js 集成指南](../integrations/nextjs)。
