# Getters

Getter 是用于根据 Store 的 State 计算衍生状态的函数。

**概念解析：**

*   **计算值（Computed Values）：** 可以把它们看作是 Store 的计算属性（Computed Properties）。当需要根据其他状态属性计算数据时，它们非常有用。
*   **缓存（Cached）：** Getter 是带缓存的。只有当它依赖的项（State 属性或其他 Getter）发生变化时，它才会重新计算，这能有效提高性能。

通过 `defineStore()` 的 `getters` 属性来定义 Getter。它们接收 `state` 作为第一个参数。

```tsx
export const { useStore: useCounterStore } = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount: (state) => state.count * 2,
  },
})
```

## 访问其他 Getter

如果要在某个 Getter 内部使用其他 Getter，你可以使用普通函数形式，并通过 `this` 访问 Store 的其他属性。在 TypeScript 中，你**必须**显式定义返回类型才能使其正常工作。

```tsx
export const { useStore: useCounterStore } = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount(state) {
      return state.count * 2
    },
    // 此处**必须**显式设置返回类型
    doublePlusOne(): number {
      // 这里的 `this` 拥有自动补全和类型注解 ✨
      return this.doubleCount + 1
    },
  },
})
```

然后，你可以在组件中直接通过 Store 实例访问 Getter：

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function CounterComponent() {
  const counter = useCounterStore();

  return (
    <p>双倍计数值是 {counter.doubleCount}</p>
  );
}
```

## 访问其他 Store 的 Getter

要使用其他 Store 的 Getter，只需获取那个 Store 的实例并使用即可。请记住，在 React 组件之外的场景（例如在另一个 Store 的逻辑中），需要使用 `getStore` 函数。

```tsx
import { getOtherStore } from './other-store'

export const { useStore: useMainStore } = defineStore('main', {
  state: () => ({
    localData: 'hello'
  }),
  getters: {
    combinedData(state): string {
      const otherStore = getOtherStore()
      return state.localData + ' ' + otherStore.data
    },
  },
})
```