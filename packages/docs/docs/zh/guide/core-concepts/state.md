# State (状态)

State 保存应用需要共享的数据。组件会订阅渲染时读取的状态，相关数据变化时更新视图。

公开状态只读，包括组件和 `getStore()` 返回的状态。请通过 Action、`$patch()` 或 `$reset()` 修改；Getter 只用于读取和计算。Immer 会将 Action 和 `$patch()` 中的修改转换为不可变状态更新。

使用 `state()` 工厂返回初始状态。推荐使用 JSON 兼容的字符串、有限数字、布尔值、`null`、普通对象和数组。`Date`、`Map`、`Set`、类实例、函数、Promise 和浏览器对象的响应式修改与传输不作保证。

```tsx
import { defineStore } from 'pinia-react'

export const { useCounterStore, getCounterStore } = defineStore('counter', {
  // 推荐使用箭头函数以获得完整的类型推导
  state: () => {
    return {
      count: 0,
      name: 'Eduardo',
      items: [] as { name: string; quantity: number }[],
    }
  },
})
```

## TypeScript

只要你开启了 TypeScript 的 `strict` 模式，Pinia-React 就会自动推导 State 的类型。但在处理空数组或可空对象时，你可能需要手动辅助推导：

```tsx
interface UserInfo {
  name: string
  age: number
}

const { useStore, getStore } = defineStore('counter', {
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

const { useStore, getStore } = defineStore('counter', {
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

在 React 组件或自定义 Hook 内部，调用 `useCounterStore()`。组件外使用 `getCounterStore()`，详见[在组件外使用 Store](./outside-component-usage.mdx)。也可以使用通用的 `useStore` 和 `getStore` 别名。

```tsx
import { useCounterStore } from './stores/counter';

function MyComponent() {
  const store = useCounterStore();
  
  return <div>Count: {store.count}</div>;
}
```

### 在 Store 内部（Action 或 Getter 中）

在 Store 自己的 Action 或 Getter 中，使用 `this` 关键字来访问 State 和其他 Store 属性。

```tsx
defineStore('counter', {
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

调用 `$reset()` 会重新执行 `state()` 工厂，恢复默认值。即使 Store 最初使用了服务端快照，也不会恢复那份快照。

```tsx
const store = useCounterStore()
store.$reset()
```

## 使用 `$patch` 修改 State

虽然 Action 是修改 State 的推荐方式，但 `$patch` 方法在需要批量修改多个状态时非常有用。

`$patch` 方法接受函数或浅层部分状态对象。该函数接收一个基于 Immer 的 `draft`（草稿）状态对象。你可以安全地“修改”这个 `draft` 对象，Immer 会为你生成新的不可变状态。

```tsx
store.$patch((draft) => {
  draft.count++;
  draft.name = 'DIO';
  draft.items.push({ name: 'shoes', quantity: 1 });
})
```

对象形式在一次提交中浅层替换顶层字段：

```ts
store.$patch({ count: 2, name: 'Ada' })
```

传入嵌套对象时，需要给出该字段的完整替换值。两种 patch 在状态没有变化时都不产生 Mutation。函数回调必须同步执行，不要保留其中的 Immer Draft。

## 替换 State

你不能直接替换整个 `$state` 对象。下面的写法会触发警告；在严格模式下还会抛错：

```tsx
// 这样写是无效的
store.$state = { count: 24 }
```

可以在 `$patch()` 中通过 `Object.assign()` 覆盖字段。它不会删除新对象中未提供的已有字段：

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

## Mutation 元数据

订阅回调的可选第三个参数为已提交事件。原有的双参数回调仍然有效：

```ts
store.$subscribe((state, prevState, event) => {
  console.log(event?.meta.type, event?.meta.origin, event?.meta.actionId)
})
```

其他 Store 引起的 Getter 缓存失效会更新依赖组件，不会触发状态订阅；MutationEvent 只属于真实改变状态的 Store。
