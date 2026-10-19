# 插件 (Plugins)

Pinia-React 支持通过插件来扩展功能。插件是一个在每个 Store 实例创建时应用的函数。你可以：

- 向 Store 添加新的属性或方法。
- 增强现有的方法，如 `$reset`。
- 实现副作用，例如日志记录或本地存储（Local Storage）持久化。

通过在应用入口调用 `pinia.use()` 将插件添加到你的 Pinia 实例中。

```ts
import { createPinia } from 'pinia-react'

// 一个简单的插件，向每个 Store 添加一个静态属性
function CreatedAtPlugin() {
  return { createdAt: new Date() }
}

const pinia = createPinia()
pinia.use(CreatedAtPlugin)

// 在组件或其他文件中...
// const store = useSomeStore()
// console.log(store.createdAt) // Store 创建的时间
```

## 简介

Pinia 插件是一个接收 `context` 对象并可选择性返回要添加到 Store 的属性对象的函数。

context 对象提供 Store 定义、所属 Pinia 和受控恢复入口：

- `id`: Store 的唯一 ID（传递给 `defineStore` 的第一个参数）。
- `store`: 插件正在增强的 Store 实例。
- `options`: 传递给 `defineStore()` 的选项对象。

```ts
export function myPiniaPlugin(context) {
  console.log(`插件已应用到 Store: ${context.id}`)
  // context.store
  // context.options
}
```

## 扩展 Store

你可以通过从插件返回对象来向每个 Store 添加属性。这些属性会被合并到 Store 实例中。

```ts
pinia.use(() => ({ hello: 'world' }))
```

你也可以直接在 `store` 对象上添加属性，这对于需要访问 Store 本身的复杂对象或函数非常有用。

```ts
pinia.use(({ store }) => {
  store.customMethod = () => {
    console.log(`Hello from ${store.$id}`)
  }
})
```

**警告：** 插件**绝不**应该直接修改 `store.$state`（例如 `store.$state.newProp = ...`）。这样做会绕过响应式系统，导致 UI 无法更新。所有的状态修改都必须通过 Action 或 `$patch` 进行。

## 增强 `$reset`

内置的 `$reset()` 方法只会重置在 `state()` 函数中定义的状态。如果插件向 Store 添加了自己的属性，你可能希望 `$reset` 也能处理它们。正确的方法是增强（或“包装”）原始的 `$reset` 方法。

下面是一个安全的示例：该插件添加了一个 `ephemeralCounter` 属性和一个自增方法，并增强了 `$reset` 以同时重置这个计数器。

```ts
function EphemeralCounterPlugin({ store }) {
  // 直接向 Store 实例添加新属性
  store.ephemeralCounter = 0

  // 绑定原始的 $reset 方法
  const originalReset = store.$reset.bind(store)

  return {
    // 添加新方法
    incrementEphemeral() {
      store.ephemeralCounter++
    },
    // 返回一个新的、增强后的 $reset 函数
    $reset() {
      // 首先执行原始的重置逻辑
      originalReset()
      // 然后，重置插件自己的属性
      store.ephemeralCounter = 0
      console.log('临时计数器也已被重置。')
    },
  }
}

pinia.use(EphemeralCounterPlugin)
```

## 在插件中调用 `$subscribe`

使用 `store.$subscribe` 观察真实状态提交。存储持久化请使用 [@pinia-react/persistedstate](./persistedstate)，它统一处理筛选、安全合并、错误和恢复期回写隔离。

```ts
pinia.use(({ store }) => {
  store.$subscribe((state, previous, event) => {
    console.log(event?.meta.type, state, previous)
  })
})
```

## TypeScript 支持

### 为插件添加类型

你可以为插件的上下文（context）添加类型注解，以获得更好的类型安全和自动补全。

```ts
import { PiniaPluginContext } from 'pinia-react'

export function myPiniaPlugin(context: PiniaPluginContext) {
  // ...
}
```

### 为新 Store 属性添加类型

当你通过插件向 Store 添加新属性时，你必须在 `PiniaCustomProperties` 接口中全局声明它们，以便 TypeScript 能够识别。

```ts
import 'pinia-react'

// 确保该文件被视为一个模块
export {}

declare module 'pinia-react' {
  export interface PiniaCustomProperties {
    // 在这里添加插件的属性类型
    createdAt: Date;
    ephemeralCounter: number;
    incrementEphemeral: () => void;
  }
}
```

现在，你可以在任何 Store 实例上访问这些属性，并享受完整的类型支持。
## 初始化与 Mutation 来源

插件在每个 Store 创建时执行，此时 state 工厂默认值或 Provider 的完整 initialStores 快照已经写入 store.$state 和 pinia.state[id]，Store 也已注册到 pinia._s。请在创建 Store 前注册插件；后注册的插件不会作用于已有 Store。

context 还包含 pinia 和插件专用的 restoreState 函数。外部状态替换应通过 restoreState 进入统一提交流程，并保留来源：

```ts
pinia.use(({ restoreState }) => ({
  restoreFromSnapshot(snapshot) {
    restoreState(snapshot, { type: 'restore', origin: 'my-plugin' })
  }
}))
```

store.$subscribe((state, prevState, event) => {}) 与 pinia.onMutation 接收同一个已提交事件。可选元数据包含 type、origin、action、actionId 和 parentActionId。可通过 origin 避免将恢复操作发回来源。仅 Getter 失效不会创建业务 Mutation。

Provider 通过仅初始化生效的 `plugins` 属性，在 Store 创建前注册插件。持久化仍属于独立插件策略，参阅[状态持久化指南](./persistedstate)。核心不访问存储、不决定本地数据是否覆盖 initialStores。基础服务端安全不等于完整 Next.js hydration 适配。

## 插件资源清理

当前 core 提供 `context.onDispose(cleanup)`。context 类型将它保留为可选能力，旧宿主和手写测试对象可以不提供。需要外部资源的插件，应自行管理生命周期，或先检查此能力再取得资源：

~~~ts
pinia.use(({ onDispose }) => {
  if (!onDispose) return
  const timer = setInterval(() => console.log('heartbeat'), 1000)
  onDispose(() => clearInterval(timer))
})
~~~

每次登记属于当前 Store 安装，不属于共享插件工厂。实例销毁或安装失败时，同步逆序执行回调。返回函数只取消登记，不执行 cleanup。取得资源后立即登记；异步 cleanup 不会被等待，清理时直接释放资源，不再读写已关闭的 Store。

同步安装期间创建的 core 订阅自动归属当前安装；之后建立的订阅以及外部计时器、监听和连接需要显式清理。Store 安装前由工厂取得的资源仍由工厂持有者负责。缺少 `onDispose` 的旧宿主不会仅因升级插件就获得销毁保证。

某个清理回调失败时，其余回调仍会执行，最后报告 `AggregateError`。初始化和清理都失败时，原初始化异常保留为第一项和 `cause`。已完成的业务副作用不会回滚。Provider 卸载不销毁实例，最终持有者应先卸载依赖组件，再调用 `disposePinia(pinia)`。
