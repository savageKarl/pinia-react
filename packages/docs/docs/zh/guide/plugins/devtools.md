# DevTools

Pinia-React 可以通过可选的 `@pinia-react/devtools` 包，将 Store 接入 [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools)。

该能力与核心包分开发布，并要求每个 Store 显式启用。它是 Redux DevTools 集成，并不是 Vue Devtools 集成。

## 安装

安装核心库、DevTools 插件，并在浏览器中安装 Redux DevTools 扩展：

```bash
pnpm add pinia-react
pnpm add -D @pinia-react/devtools
```

创建 Pinia 实例后应立即注册插件。插件只会在 Store 首次创建时应用，因此必须在调用 Store Hook 或 `getStore()` 方法前完成注册。

```ts title="src/pinia.ts"
import { createPinia } from 'pinia-react'
import { devtoolsPlugin } from '@pinia-react/devtools'

const pinia = createPinia()

if (import.meta.env.DEV) {
  pinia.use(devtoolsPlugin())
}

export { pinia }
```

客户端应用建议使用环境判断，但服务端渲染并不强制要求。`window` 或 Redux DevTools Extension 不存在时，插件不会执行任何操作。

## 为 Store 启用 DevTools

Store 不会自动连接。请为每个需要检查的 Store 添加 `devtools.enabled: true`：

```ts title="src/stores/counter.ts"
import { defineStore } from 'pinia-react'

export const { useCounterStore, getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: {
    increment() {
      this.count++
    }
  },
  devtools: {
    enabled: true,
    name: 'Counter Store',
    trace: true
  }
})
```

`enabled` 的值必须是 `true`。不配置 `devtools` 时，该 Store 不会连接。

## 连接名称

每个启用的 Store 都会建立独立的 Redux DevTools 连接。插件级 `name` 用于标识应用，Store 级 `name` 用于标识 Store：

```ts
pinia.use(devtoolsPlugin({ name: 'Admin' }))

defineStore('users', {
  state: () => ({ users: [] }),
  devtools: {
    enabled: true,
    name: 'Users'
  }
})
```

该连接会显示为 `Admin: Users`。未提供自定义名称时，将使用 Store ID。

## 支持的操作

插件会把以下已提交的变更发送到 Redux DevTools：

- Action，包括 action 名称和参数。
- `$patch()` 调用，包括对应的 Immer patches。
- `$reset()` 调用。
- 其他插件通过 Pinia 插件 API 执行的状态恢复。

连接建立时会使用 Store 当前状态进行初始化。在 Redux DevTools 中，Pinia-React 支持：

- 跳转到指定状态或 action。
- 回滚。
- 重置为 Store 的 `state()` 函数返回值。
- 将当前状态提交为新的 DevTools 基线。
- 导入 Redux DevTools 状态历史，并恢复其最后一个计算状态。

由 DevTools 发起的状态变更不会再次作为新变更发送，从而避免反馈循环。

## 配置项

### 插件配置

| 配置项 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string` | 所有 Store 连接共用的应用名称前缀。 |

### Store 配置

| 配置项 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 显式连接该 Store。 |
| `name` | `string` | 在连接名称中覆盖 Store ID。 |
| `trace` | `boolean` | 将 Redux DevTools 的 action 调用栈追踪配置传递给扩展。 |

## 当前限制

该插件不提供 Vue Devtools 中的 Pinia 检查器、组件到 Store 的检查能力或 Pinia 专属时间线，也不会在应用内添加调试界面。所有状态检查和历史控制均由 Redux DevTools Extension 提供。
