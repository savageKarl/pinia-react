# Getter

 Getters 是用于从 State 中计算或派生新数据的函数。

**概念解释：**
* **只读:** Getters 仅用于获取数据，不应该直接修改 State。
* **依赖追踪:** 只有当 Getters 所依赖的 State 数据发生变化时，它才会重新计算。这避免了不必要的重复计算，提高了性能。

你可以通过 defineStore() 中的 getters 属性来定义它们。推荐使用箭头函数，并且它将接收 state 作为第一个参数：

```tsx
export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount: (state) => state.count * 2,
  },
})
```

大多数时候，getter 仅依赖 state。不过，有时它们也可能会使用其他 getter。因此，即使在使用常规函数定义 getter 时，我们也可以通过 this 访问到整个 store 实例，但(在 TypeScript 中)必须定义返回类型。这是为了避免 TypeScript 的已知缺陷，不过这不影响用箭头函数定义的 getter，也不会影响不使用 this 的 getter。

```tsx
export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    // 自动推断出返回类型是一个 number
    doubleCount(state) {
      return state.count * 2
    },
    // 返回类型**必须**明确设置
    doublePlusOne(): number {
      // 整个 store 的 自动补全和类型标注 ✨
      return this.doubleCount + 1
    },
  },
})
```

然后你可以直接访问 store 实例上的 getter 了：

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function CounterWithPinia() {
  const counter = useCounterStore();

  return (
    <p>Double count is {{ store.doubleCount }}</p>
  );
}
```


## 访问其他 getter 

你也可以组合多个 getter。通过 this，你可以访问到其他任何 getter。在这种情况下，你需要为这个 getter 指定一个返回值的类型。

```tsx
export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount(state) {
      return state.count * 2
    },
    doubleCountPlusOne(): number {
      return this.doubleCount + 1
    },
  },
})
```

## 访问其他 store 的 getter 

想要使用另一个 store 的 getter 的话，那就直接在 getter 内使用就好：

```tsx
import { useOtherStore } from './other-store'

export const useStore = defineStore('main', {
  state: () => ({
    // ...
  }),
  getters: {
    otherGetter(state) {
      const otherStore = useOtherStore.$getStore()
      return state.localData + otherStore.data
    },
  },
})
```