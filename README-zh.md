# pinia-react

`pinia-react` 是一个轻量级且类型安全的 React 状态管理库。它将 Vue Pinia 的优雅开发体验带到了 React 生态中，结合了 **Immer** 的不可变数据流和 **React Hooks** 的原生性能。

核心特性：
- **响应式**: 基于 `useSyncExternalStore` 构建，完美支持 React 18+ 的并发渲染 (Concurrent Rendering)。
- **高效**: 细粒度的依赖自动追踪。组件只有在真正使用的属性发生变化时才会重新渲染，无需手动编写 selector。
- **直观**: 在 Actions 中使用可变 (Mutable) 语法直接修改状态 (底层由 Immer 处理)，代码更简洁。
- **开发工具**: 开箱即用支持 Redux DevTools Extension，支持时间旅行和状态快照。

## 安装

```bash
pnpm add pinia-react
```

## 快速开始

### 1. 初始化 Pinia

你只需要在应用入口处调用一次 `createPinia()` 即可初始化全局 Store 注册表。

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createPinia } from 'pinia-react'
import App from './App'

// ⚠️ 必须：在渲染应用之前初始化全局 pinia 实例
createPinia()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### 2. 定义 Store

`defineStore` 返回一个包含 `useStore` Hook 和 `getStore` 方法的对象。

```ts
// src/stores/counter.ts
import { defineStore } from 'pinia-react'

// 返回值结构为 { useStore, getStore }
export const counterStoreDefinition = defineStore('counter', {
  // State: 返回初始状态的函数
  state: () => ({
    count: 0,
    name: 'Pinia'
  }),

  // Getters: 计算属性，具备缓存机制
  getters: {
    doubleCount() {
      // `this` 指向当前 store 实例
      return this.count * 2
    }
  },

  // Actions: 修改状态的方法
  actions: {
    increment() {
      // `this` 是一个 Immer draft，你可以直接修改它！
      this.count++
    },
    async renameAsync(newName: string) {
      // 完全支持异步操作
      await new Promise(r => setTimeout(r, 500))
      this.name = newName
    }
  }
})

// 导出 Hook 供组件使用
export const useCounterStore = counterStoreDefinition.useStore
```

### 3. 在组件中使用

```tsx
import { useCounterStore } from '../stores/counter'

export function Counter() {
  // store 是一个 Proxy 对象，它会自动追踪你访问了哪些属性
  const store = useCounterStore()

  return (
    <div>
      {/* 只有当 count 变化时，组件才会重渲染 */}
      <p>Count: {store.count}</p>
      
      {/* 只有当 doubleCount 变化时，组件才会重渲染 */}
      <p>Double: {store.doubleCount}</p>

      {/* 调用 Actions 修改状态 */}
      <button onClick={() => store.increment()}>+1</button>
      
      {/* 
        ⚠️ 注意：在组件中，Store 的属性是【只读】的。
        store.count++ // ❌ 这会触发警告并失败
        请始终使用 actions 或 $patch 来修改状态。
      */}
    </div>
  )
}
```

## 核心 API

### `$patch`

允许你使用回调函数一次性更新多个状态属性。回调函数接收一个 Immer draft。

> **注意**：与 Vue 的 Pinia 不同，本实现仅支持**回调函数**形式，不支持传入对象。

```ts
const store = useCounterStore()

store.$patch((state) => {
  // 在这里可以进行批量修改
  state.count += 10
  state.name = 'Patched'
})
```

### `$reset`

将 Store 的状态重置为初始值（即执行 `state()` 函数返回的结果）。

```ts
store.$reset()
```

### `$subscribe`

手动监听状态变化。

```ts
useEffect(() => {
  // 订阅状态变更
  const unsubscribe = store.$subscribe((newState, oldState) => {
    console.log('状态已更新:', newState)
  })
  
  // 组件卸载时取消订阅
  return unsubscribe
}, [store])
```

### `getStore` (在组件外部使用)

如果你需要在 React 组件之外（例如路由守卫、纯工具函数或 API 拦截器）访问 Store，请使用 `getStore`。

```ts
import { counterStoreDefinition } from './stores/counter'

function logCount() {
  // 不使用 Hook 获取当前活跃的 store 实例
  const store = counterStoreDefinition.getStore()
  console.log(store.count)
}
```

## TypeScript 支持

得益于泛型推导，绝大多数情况下你不需要手动编写类型声明。

```ts
type CounterState = { count: number }

export const { useStore } = defineStore('id', {
  state: (): CounterState => ({ count: 0 }),
  // actions 和 getters 的类型会自动推导
})
```

## 文档
要了解更多关于 Pinia-React 的信息，请查阅其[文档](https://savagekarl.github.io/pinia-react)。

## License

MIT
