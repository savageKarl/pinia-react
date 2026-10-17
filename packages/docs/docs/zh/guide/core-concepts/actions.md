# Actions

Action 用于修改 State 和组织业务逻辑，可以访问当前 Store 的 State、Getter 和其他 Action，也可以执行异步请求或计算。

在 `defineStore()` 的 `actions` 中定义方法，通过 `this` 修改状态。组件和普通业务代码不能直接修改公开状态；批量修改和重置也可以使用 `$patch()` 和 `$reset()`。

```tsx
import { defineStore } from 'pinia-react'

export const { useCounterStore } = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  actions: {
    increment() {
      this.count++;
    },
    randomizeCounter() {
      this.count = Math.round(100 * Math.random());
    },
  },
});
```

普通方法中的 `this` 指向当前 Store，支持状态、Getter 和 Action 的类型推导。

你可以像调用普通函数一样，在组件中调用 Action：

```tsx
export function App() {
  const store = useCounterStore();
  
  return (
    <button onClick={() => store.randomizeCounter()}>随机化</button>
  );
}
```

Action 可以使用 `async` / `await`。例如，等待一秒后再增加计数：

```tsx
import { defineStore } from 'pinia-react'

export const { useCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: {
    async incrementLater() {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000))
      this.count++
    },
  },
})
```

## Action 提交与异步操作

### await 前后的状态

Action 始终使用稳定的修改代理，`await` 前后都读取和修改最新的已提交状态。可以保留在 await 前捕获的嵌套引用：

```ts
actions: {
  async rename() {
    const profile = this.profile
    await save()
    profile.name = 'Ada'
  },
}
```

并发 Action 基于最新状态修改，嵌套 Action 的修改也会保留。Action 保留普通返回值和 Promise 语义，不会暴露 Immer Draft。

### 多次修改与批量提交

每次普通赋值都会立即提交；实际改变状态时，各自产生一个 `MutationEvent`。只读取状态的 Action 不产生事件。

需要把多次修改合为一次提交时，显式使用批量边界：

```ts
this.$patch((state) => {
  state.loading = false
  state.items.push(item)
})
this.$patch({ loading: false, error: null })
```

状态发生变化时，两种 patch 都只提交一次；没有变化时不产生事件。对象形式浅层替换传入的顶层字段，不深度合并。数组的 push、pop、shift、unshift、splice、sort、reverse、fill 和 copyWithin 方法每次调用也只提交一次。

### 异常与回滚

Action 抛错或 Promise 拒绝时，已提交的修改会保留。请用 try/catch/finally 显式处理清理。同步 $patch 回调抛错时，该次草稿修改不会提交。$patch 的 Draft 仅在同步回调期间有效，不能保留到 await 之后。

### Action 事件元数据

同一 Action 的事件共享 `meta.actionId`。嵌套 Action 有自己的 ID，并通过 `meta.parentActionId` 关联父 Action。Action 内的 `$patch()` 和 `$reset()` 保留自身事件类型，同时继承 Action 元数据。

## 访问其他 Store 的 Action

如果需要使用另一个 Store 的 Action 或 State，只需在 Action 内部获取那个 Store 的实例即可。

```tsx
import { getAuthStore } from './auth-store';

export const { useSettingsStore } = defineStore('settings', {
  state: () => ({
    preferences: null,
  }),
  actions: {
    async fetchUserPreferences() {
      const auth = getAuthStore();
      if (auth.isAuthenticated) {
        this.preferences = await fetchPreferences();
      } else {
        throw new Error('用户必须先登录');
      }
    },
  },
});
```