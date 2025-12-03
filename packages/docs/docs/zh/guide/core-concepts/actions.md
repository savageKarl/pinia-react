# Actions

Action 是用于修改 **State（状态）** 的方法。它们是你存放业务逻辑的地方。Action 可以是异步的，并且可以包含 API 调用、复杂的计算逻辑以及对多个状态变量的修改。

**概念解析：**

*   **业务逻辑（Business Logic）：** Action 是集中管理业务逻辑的理想场所，这样可以保持组件代码的整洁。
*   **异步支持（Asynchronous）：** Action 可以是 `async` 函数。你可以在其中 `await` API 调用或任何 Promise。
*   **状态变更（State Mutations）：** 所有的状态修改理想情况下都应该发生在 Action 内部，这样可以让状态的变化可预测且易于追踪。

通过 `defineStore()` 的 `actions` 属性来定义 Action。

```tsx
export const { useStore: useCounterStore } = defineStore('main', {
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

export const { useStore: useUsersStore } = defineStore('users', {
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

## 访问其他 Store 的 Action

如果需要使用另一个 Store 的 Action 或 State，只需在 Action 内部获取那个 Store 的实例即可。

```tsx
import { getAuthStore } from './auth-store';

export const { useStore: useSettingsStore } = defineStore('settings', {
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