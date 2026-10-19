# pinia-react

`pinia-react` 是面向 React 应用的结构化、类型安全 Store。它将共享业务状态组织为 State、Getter 和 Action，再通过 `useSyncExternalStore` 接入 React。

当应用需要明确的 Store 边界、命名的派生值、Action 生命周期，以及能同时服务于组件和普通 TypeScript 代码的插件时，可以选择 Pinia-React。

核心特性：
- **结构化**: State、Getter 和 Action 为共享业务逻辑提供明确位置。
- **兼容 React**: 基于 `useSyncExternalStore`，遵循 React 18 和 19 的渲染语义。
- **自动依赖追踪**: 追踪渲染期间读取的状态路径，因此无关字段的提交不会通知该组件的 Store 订阅。
- **Immer Action**: 使用可变语法编写 Action，得到不可变的状态转换。
- **可选集成**: 持久化和 Redux DevTools 通过独立包提供，并明确浏览器与 SSR 边界。

自动追踪过滤 Store 订阅更新。父组件更新、props、Strict Mode 或并发渲染仍可能让 React 重新渲染组件。

## 安装

需要 React 18 或 19。

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

`defineStore` 返回一个包含默认的 `useStore` Hook 和 `getStore` 方法的对象，同时会根据 Store ID 自动生成对应的命名方法。

```ts
// src/stores/counter.ts
import { defineStore } from 'pinia-react'

// `defineStore('counter')` 同时提供 `useCounterStore` 和 `getCounterStore`
export const { useCounterStore, getCounterStore } = defineStore('counter', {
  // State: 返回初始状态的函数
  state: () => ({
    count: 0,
    name: 'Pinia'
  }),

  // Getters: 计算属性，具备缓存机制
  getters: {
    doubleCount(): number {
      // `this` 指向当前 store 实例
      return this.count * 2
    }
  },

  // Actions: 修改状态的方法
  actions: {
    increment() {
      // Action 中可以直接赋值，由 Immer 提交不可变更新。
      this.count++
    },
    async renameAsync(newName: string) {
      // 完全支持异步操作
      await new Promise(r => setTimeout(r, 500))
      this.name = newName
    }
  }
})

```

### 3. 在组件中使用

```tsx
import { useCounterStore } from '../stores/counter'

export function Counter() {
  // store 是一个 Proxy 对象，它会自动追踪你访问了哪些属性
  const store = useCounterStore()

  return (
    <div>
      {/* Store 订阅会追踪本次渲染读取的路径。 */}
      <p>Count: {store.count}</p>

      {/* Getter 根据当前 count 派生。 */}
      <p>Double: {store.doubleCount}</p>

      {/* 调用 Actions 修改状态 */}
      <button onClick={() => store.increment()}>+1</button>

      {/*
        ⚠️ 注意：在组件中，Store 的属性是【只读】的。
        store.count++ // 组件中是只读的。
        请使用 Action 或 $patch 修改状态。
      */}
    </div>
  )
}
```

## 核心 API

### `$patch`

允许你一次性更新多个状态属性。需要 Immer draft 时使用回调函数；替换顶层字段时可以传入浅层对象。

```ts
const store = getCounterStore()

store.$patch((state) => {
  // 在这里可以进行批量修改
  state.count += 10
  state.name = 'Patched'
})

store.$patch({ count: 10, name: 'Patched' })
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

### 命名 `getXxxStore` 方法 (在组件外部使用)

如果你需要在 React 组件之外（例如路由守卫、纯工具函数或 API 拦截器）访问 Store，可以使用根据 Store ID 自动生成的命名 `getXxxStore` 方法。

```ts
import { getCounterStore } from './stores/counter'

function logCount() {
  // 不使用 Hook 获取当前活跃的 store 实例
  const store = getCounterStore()
  console.log(store.count)
}
```

使用多个实例时，通过 `getCounterStore(pinia)` 显式指定 Pinia；React 组件使用最近的 `PiniaProvider`。接入方式参阅[组件外使用指南](https://savagekarl.github.io/pinia-react/zh/guide/core-concepts/outside-component-usage)。

## TypeScript 支持

得益于泛型推导，绝大多数情况下你不需要手动编写类型声明。

```ts
type CounterState = { count: number }

export const { useIdStore, getIdStore } = defineStore('id', {
  state: (): CounterState => ({ count: 0 }),
  // actions 和 getters 的类型会自动推导
})
```

## DevTools

DevTools 能力由可选的 `@pinia-react/devtools` 包提供。它会将显式启用的 Store 接入 Redux DevTools Extension，并不是 Vue Devtools 集成。

```bash
pnpm add -D @pinia-react/devtools
```

请在任何 Store 创建前注册插件，然后为需要调试的 Store 显式开启 DevTools：

```ts
import { createPinia, defineStore } from 'pinia-react'
import { devtoolsPlugin } from '@pinia-react/devtools'

const pinia = createPinia()
pinia.use(devtoolsPlugin({ name: 'My App' }))

export const { useCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  devtools: {
    enabled: true,
    name: 'Counter'
  }
})
```

插件会记录 action、`$patch()` 和 `$reset()`。你可以在 Redux DevTools 中查看状态，并执行跳转、回滚、重置、提交和导入状态。配置项和限制请参阅 [DevTools 指南](https://savagekarl.github.io/pinia-react/zh/guide/plugins/devtools)。

## 状态持久化

安装 `@pinia-react/persistedstate`，在 Store 创建前注册默认插件，并通过 `persist: true` 开启。`createPersistedState` 支持全局默认值、`auto`、自定义 key、同步存储、嵌套 `pick` / `omit`、钩子和有序多策略。浏览器 React SPA 的 `PiniaProvider` 支持仅初始化生效的 `plugins={[persistedState]}`。

```bash
pnpm add @pinia-react/persistedstate
```

```ts
import { createPinia, defineStore } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'

createPinia().use(persistedState)

export const { usePreferencesStore } = defineStore('preferences', {
  state: () => ({ theme: 'light' }),
  persist: true
})
```

手动 `$hydrate?.()` / `$persist?.()` 只存在于启用的 Store。服务端 App Router 偏好可使用独立的 `@pinia-react/persistedstate/next` Cookie 适配器与白名单请求快照；默认 localStorage 插件仍面向 SPA，接入、API 与安全限制参阅[持久化指南](https://savagekarl.github.io/pinia-react/zh/guide/plugins/persistedstate)。

## 运行示例

仓库中可运行的示例如下：

| 示例 | 运行位置 |
| --- | --- |
| 基础 Store、Getter、Action 和异步更新 | React Playground `#counter` 与 `#comparison`；[Action 指南](https://savagekarl.github.io/pinia-react/zh/guide/core-concepts/actions) |
| 共享状态 | React Playground `#sharing` |
| SSR 快照与 hydration | Next.js Playground；[Next.js 指南](https://savagekarl.github.io/pinia-react/zh/guide/integrations/nextjs) |
| 浏览器持久化 | React Playground `#persistence`；[持久化指南](https://savagekarl.github.io/pinia-react/zh/guide/plugins/persistedstate) |
| DevTools | 在 React Playground 中使用 Redux DevTools Extension；[DevTools 指南](https://savagekarl.github.io/pinia-react/zh/guide/plugins/devtools) |
| Zustand 对比 | React Playground `#comparison`；[对比指南](https://savagekarl.github.io/pinia-react/zh/guide/integrations/compare-zustand) |

对比页中的渲染计数仅用于观察，不是速度评分。

```bash
pnpm install
pnpm playground-react
pnpm playground-nextjs
```

开发命令和贡献流程参阅 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 文档

要了解更多关于 Pinia-React 的信息，请查阅其[文档](https://savagekarl.github.io/pinia-react/zh/)。

## License

MIT
