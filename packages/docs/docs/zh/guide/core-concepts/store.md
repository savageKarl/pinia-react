# 定义 Store

在深入研究核心概念之前，我们得知道 Store 是用 defineStore() 定义的，它的第一个参数要求是一个独一无二的名字：

```tsx
import { defineStore } from 'pinia-react'

//  `defineStore()` 的返回值的命名是自由的
// 但最好含有 store 的名字，且以 `use` 开头，以 `Store` 结尾。
// (比如 `useUserStore`，`useCartStore`，`useProductStore`)
// 第一个参数是你的应用中 Store 的唯一 ID。
export const useAlertsStore = defineStore('alerts', {
  // 其他配置...
})
```

这个名字 ，也被用作 id ，是必须传入的， Pinia 将用它来连接 store 。为了养成习惯性的用法，将返回的函数命名为 use..., 因为返回的是一个 hook 。

## Option Store 

传入一个带有 state、actions 与 getters 属性的 Option 对象


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


## 使用 Store 

定义 store 之后，直接导入在组件使用即可。

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function App() {
  // 在组件内部的任何地方均可以访问变量 `store` ✨
  const counter = useCounterStore();

  return (
    <div>
      <h2>Pinia-React Count: {counter.count}</h2>
    </div>
  );
}
```
```