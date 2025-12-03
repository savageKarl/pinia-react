# State (状态)

State 是 Store 的核心。它是一个响应式对象，包含了需要在应用中共享的原始数据。

**核心概念：**

*   **响应式（Reactivity）：** State 是响应式的。当 State 中的数据发生变化时，所有依赖该数据的组件都会自动更新视图。
*   **不可变性（Immutability）：** 在底层，状态修改由 `immer` 处理。这意味着即使你写的是“可变（Mutating）”风格的代码，底层状态也是以不可变的方式更新的。

State 被定义为一个返回初始状态对象的函数。

```tsx
import { defineStore } from 'pinia-react'

const { useStore, getStore } = defineStore('storeId', {
  // 推荐使用箭头函数以获得完整的类型推导
  state: () => {
    return {
      count: 0,
      name: 'Eduardo',
      items: [],
    }
  },
})

export const useMyStore = useStore
export const getMyStore = getStore
```

## TypeScript

只要你开启了 TypeScript 的 `strict` 模式，Pinia-React 就会自动推导 State 的类型。但在处理空数组或可空对象时，你可能需要手动辅助推导：

```tsx
interface UserInfo {
  name: string
  age: number
}

const { useStore, getStore } = defineStore('storeId', {
  state: () => {
    return {
      userList: [] as UserInfo[],
      user: null as UserInfo | null,
    }
  },
})
```

或者，你可以定义一个接口并显式指定 `state()` 的返回值类型：

```tsx
interface State {
  userList: UserInfo[]
  user: UserInfo | null
}

const { useStore, getStore } = defineStore('storeId', {
  state: (): State => {
    return {
      userList: [],
      user: null,
    }
  },
})
```

## 访问 State

访问 State 的方式取决于当前的上下文：

### 在 React 组件中

在 React 组件或自定义 Hook 内部，使用 `useStore` Hook 来获取 Store 实例。

```tsx
import { useMyStore } from './stores/myStore';

function MyComponent() {
  const store = useMyStore();
  
  return <div>Count: {store.count}</div>;
}
```

### 在 Store 内部（Action 或 Getter 中）

在 Store 自己的 Action 或 Getter 中，使用 `this` 关键字来访问 State 和其他 Store 属性。

```tsx
defineStore('storeId', {
  state: () => ({ count: 0 }),
  actions: {
    increment() {
      // 使用 `this` 访问 state
      this.count++;
    }
  }
})
```

## 重置 State

你可以通过调用 Store 的 `$reset()` 方法将 State 重置为初始值。

```tsx
const store = useStore()
store.$reset()
```

## 使用 `$patch` 修改 State

虽然 Action 是修改 State 的推荐方式，但 `$patch` 方法在需要批量修改多个状态时非常有用。

`$patch` 方法接受一个函数作为参数。该函数接收一个基于 Immer 的 `draft`（草稿）状态对象。你可以安全地“修改”这个 `draft` 对象，Immer 会为你生成新的不可变状态。

```tsx
store.$patch((draft) => {
  draft.count++;
  draft.name = 'DIO';
  draft.items.push({ name: 'shoes', quantity: 1 });
})
```

## 替换 State

你不能直接替换整个 `$state` 对象。下面的写法会触发警告并且不会生效：

```tsx
// 这样写是无效的
store.$state = { count: 24 }
```

要实现“替换 State”的效果，你可以使用 `$patch` 并将新状态对象的属性赋值给 draft。`Object.assign()` 是一个便捷的方法。

```tsx
const newState = {
  count: 24,
  name: 'Eduardo',
  items: [{ name: 'shirt', quantity: 2 }]
};

store.$patch((draft) => {
  // 这将用 newState 的属性覆盖 draft 的属性
  Object.assign(draft, newState);
})
```

## 订阅 State

你可以使用 Store 的 `$subscribe()` 方法监听 State 的变化。回调函数会接收新的 State 和上一次的 State 作为参数。该方法返回一个用于取消订阅的函数。

```tsx
const unsubscribe = cartStore.$subscribe((state, prevState) => {
  // 每当状态变化时，将整个状态持久化到本地存储
  localStorage.setItem('cart', JSON.stringify(state))
})

// 调用返回的函数以移除监听器
unsubscribe()
```