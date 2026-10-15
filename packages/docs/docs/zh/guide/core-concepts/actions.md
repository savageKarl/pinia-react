# Actions

Action 是用于修改 **State（状态）** 的方法。它们是你存放业务逻辑的地方。Action 可以是异步的，并且可以包含 API 调用、复杂的计算逻辑以及对多个状态变量的修改。

**概念解析：**

*   **业务逻辑（Business Logic）：** Action 是集中管理业务逻辑的理想场所，这样可以保持组件代码的整洁。
*   **异步支持（Asynchronous）：** Action 可以是 `async` 函数。你可以在其中 `await` API 调用或任何 Promise。
*   **状态变更（State Mutations）：** 所有的状态修改理想情况下都应该发生在 Action 内部，这样可以让状态的变化可预测且易于追踪。

通过 `defineStore()` 的 `actions` 属性来定义 Action。

```tsx
export const { useCounterStore } = defineStore('main', {
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

在 Action 内部，`this` 指向当前 Store 的实例，这使你可以访问 state、getter 和其他 action，并且拥有完整的类型支持。

下面是一个异步 Action 的示例：

```tsx
import { mande } from 'mande';

const api = mande('/api/users');

export const { useUsersStore } = defineStore('users', {
  state: () => ({
    userData: null,
  }),

  actions: {
    async registerUser(login, password) {
      try {
        const response = await api.post({ login, password });
        this.userData = response;
        showTooltip(`欢迎回来 ${this.userData.name}!`);
      } catch (error) {
        showTooltip(error.message);
        return error;
      }
    },
  },
});
```

你可以像调用普通函数一样，在组件中调用 Action：

```tsx
export function App() {
  const store = useCounterStore();
  
  return (
    <button onClick={() => store.randomizeCounter()}>随机化</button>
  );
}
```

## Action 提交与异步操作

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

每次普通赋值都会立即提交，真实状态变化分别产生 MutationEvent。只读取状态的 Action 不产生事件。并发 Action 基于最新状态修改，嵌套 Action 的修改也会保留。普通返回值和 Promise 语义保持不变，不会暴露 Immer Draft。

需要把多次修改合为一次提交时，显式使用批量边界：

```ts
this.$patch((state) => {
  state.loading = false
  state.items.push(item)
})
this.$patch({ loading: false, error: null })
```

两种 patch 都只提交一次。对象形式浅层替换传入的顶层字段，不深度合并。数组的 push、pop、shift、unshift、splice、sort、reverse、fill 和 copyWithin 方法每次调用也只提交一次。

Action 抛错或 Promise 拒绝时，已提交的修改会保留。请用 try/catch/finally 显式处理清理。同步 $patch 回调抛错时，该次草稿修改不会提交。$patch 的 Draft 仅在同步回调期间有效，不能保留到 await 之后。

同一 Action 的事件共享 meta.actionId；嵌套 Action 有自己的 ID，并通过 meta.parentActionId 关联父 Action。Action 内的 patch 和 reset 保留自身事件类型，同时继承 Action 元数据。

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