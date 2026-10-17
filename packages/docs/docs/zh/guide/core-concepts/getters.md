# Getters

Getter 根据 State 或其他 Getter 计算衍生数据。结果会被缓存，依赖变化后才重新计算。

在 `defineStore()` 的 `getters` 中定义 Getter；第一个参数是当前 Store 的 `state`。

```tsx
export const { useCounterStore, getCounterStore } = defineStore('counter', {
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
export const { useCounterStore, getCounterStore } = defineStore('counter', {
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

在 Getter 中调用另一个 Store 的 `getOtherStore()`，再读取需要的属性；不要调用 React Hook。通用的 `getStore()` 别名也可使用。

```tsx
import { getOtherStore } from './other-store'

export const { useMainStore, getMainStore } = defineStore('main', {
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
