# 插件

pinia 支持通过插件扩展功能，以下是你可以扩展的内容：

- 为 store 添加新的属性
- 为 store 增加新的方法
- 包装现有的方法
- 改变甚至取消 action
- 实现副作用，如本地存储
- 仅应用插件于特定 store


插件是通过 pinia.use() 添加到 pinia 实例的。最简单的例子是通过返回一个对象将一个静态属性添加到所有 store。

```ts
import { createPinia } from 'pinia-react'

// 创建的每个 store 中都会添加一个名为 `secret` 的属性。
// 在安装此插件后，插件可以保存在不同的文件中
function SecretPiniaPlugin() {
  return { secret: 'the cake is a lie' }
}

const pinia = createPinia()
// 将该插件交给 Pinia
pinia.use(SecretPiniaPlugin)

// 在另一个文件中
const store = useStore()
store.secret // 'the cake is a lie'
```

## 简介

Pinia 插件是一个函数，可以选择性地返回要添加到 store 的属性。它接收一个可选参数，即 context。

```tsx
export function myPiniaPlugin(context) {
  context.pinia // 用 `createPinia()` 创建的 pinia。
  context.store // 该插件想扩展的 store
  context.options // 定义传给 `defineStore()` 的 store 的可选对象。
}
```

然后用 pinia.use() 将这个函数传给 pinia：

```ts
pinia.use(myPiniaPlugin)
```

## 扩展 Store

你可以直接通过在一个插件中返回包含特定属性的对象来为每个 store 都添加上特定属性：

```ts
pinia.use(() => ({ hello: 'world' }))
```

你也可以直接在 store 上设置该属性，

```ts
pinia.use(({ store }) => {
  store.hello = 'world'
})
```



### 添加新的 state 

如果你想给 store 添加新的 state 属性, 你必须同时在两个地方添加它。

- 在 store 上，然后你才可以用 store.myState 访问它。
- 在 store.$state 上，然你才可以通过 store.$state.myState 访问它

```ts
pinia.use(({ store }) => {
  // eslint-disable-next-line no-prototype-builtins
  if (!Object.hasOwn(store.$state, 'pluginN')) {
    store.$state.pluginN = 20
  }
  store.pluginN = store.$state.pluginN
})
```

### 重置插件中添加的 state

默认情况下，$reset() 不会重置插件添加的 state，但你可以重写它来重置你添加的 state：

```ts
pinia.use(({ store }) => {
  // eslint-disable-next-line no-prototype-builtins
  if (!Object.hasOwn(store.$state, 'pluginN')) {
    store.$state.pluginN = 20
  }
  store.pluginN = store.$state.pluginN

  // 确认将上下文 (`this`) 设置为 store
  const originalReset = store.$reset.bind(store)

  // 覆写其 $reset 函数
  return {
    $reset() {
      originalReset()
      store.pluginN = false
    },
  }
})
```

### 在插件中调用 `$subscribe`

你也可以在插件中使用 store.$subscribe 和 store.$onAction 。

```ts
pinia.use(({ store }) => {
  store.$subscribe(() => {
    // 响应 store 变化
  })
  store.$onAction(() => {
    // 响应 store actions
  })
})
```

## TypeScript

上述一切功能都有类型支持，所以你永远不需要使用 any 或 @ts-ignore。

### 标注插件类型 

一个 Pinia 插件可按如下方式实现类型标注：

```ts
import { PiniaPluginContext } from 'pinia-react'

export function myPiniaPlugin(context: PiniaPluginContext) {
  // ...
}
```

### 为新的 store 属性添加类型

当在 store 中添加新的属性时，你也应该扩展 PiniaCustomProperties 接口。

```ts
import 'pinia'

declare module 'pinia' {
  export interface PiniaCustomProperties {
    simpleNumber: number
  }
}
```

然后，就可以安全地写入和读取它了：

```ts
pinia.use(({ store }) => {
  store.simpleNumber = Math.random()
})
```

### 为新的 state 添加类型 

当添加新的 state 属性(包括 store 和 store.$state )时，你需要将类型添加到 PiniaCustomStateProperties 中。与 PiniaCustomProperties 不同的是，它只接收 State 泛型：

```ts
import 'pinia'

declare module 'pinia' {
  export interface PiniaCustomStateProperties<S> {
    hello: string
  }
}
```