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

`context` 对象包含三个属性：

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

你可以在插件中使用 `store.$subscribe` 来监听状态变化，例如实现本地存储持久化。

```ts
pinia.use(({ store, id }) => {
  // 启动时尝试从 localStorage 获取数据
  const savedState = localStorage.getItem(id)
  if (savedState) {
    store.$patch((draft) => {
      Object.assign(draft, JSON.parse(savedState))
    })
  }

  // 订阅变化并保存回去
  store.$subscribe((state) => {
    localStorage.setItem(id, JSON.stringify(state))
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