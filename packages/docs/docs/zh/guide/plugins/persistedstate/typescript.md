# TypeScript

包内自带声明，并扩展 Pinia-React 的 Store 选项。运行时导入插件会加载扩展；抽取配置的文件可以仅导入类型。不需要在应用中另建 `pinia.d.ts` 或手工扩充 Store。

## 内联回调推导完整 Store

优先把配置放在 `defineStore` 内部。恢复钩子和错误回调都能获得 State、Getter 结果与 Action 参数及返回值，策略数组内也一样：

```ts title="counter.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const { getCounterStore, useCounterStore } = defineStore('counter', {
  state: () => ({ count: 0, preferences: { theme: 'light' } }),
  getters: { double: state => state.count * 2 },
  actions: {
    increment(amount: number) {
      this.count += amount
      return this.count
    }
  },
  persist: {
    pick: ['count', 'preferences.theme'],
    afterHydrate({ store, options }) {
      const doubled: number = store.double
      const factoryCount: number = options.state().count
      console.info(doubled, factoryCount)
    },
    onPersistError(error, store) {
      const retryAction: (amount: number) => number = store.increment
      console.warn(error.name, store.$id, typeof retryAction)
    }
  }
})
```

在 `store.` 后，编辑器应提示 `count`、`preferences`、`double`、`increment` 和核心 Store 成员。不存在的属性及错误的 Action 参数会报类型错误，而不是悄悄变成 `any`。生成的具名别名保持正常推导；`$state` 仍然只读。

导出的 `PersistenceContext<State, StoreType>` 描述 Store 级恢复上下文：`store` 是完整推导后的 Store，`options.state()` 和插件专用 `restoreState` 载荷保留 State 类型。`restoreState` 不是新的应用修改入口，业务代码仍使用 Action 和 `$patch`。

## 路径补全不是 schema 校验

`StatePath<State>` 为 `pick` / `omit` 提供点号分隔的普通对象路径建议：

- 包含可选、可空嵌套字段和联合类型各分支的成员。
- 数组和 `Date` 等特殊对象只提示整个字段，不提示数组下标、数组方法或实例方法路径。
- 递归类型的路径展开最多六段，避免编辑器无限展开。
- 不提示危险 key、空 key 或本身含点号的 key。

有意保留动态 `string` 路径支持，因此拼错的路径也可能通过编译，运行时不存在则被忽略。补全**不是严格路径校验**；TypeScript 和载荷形状校验也不验证业务 schema。宽泛字典无法列举未知运行时 key。即使提示了 `Date` 字段，也仍需选择合适的可持久化表示，不能据此推断可往返恢复或响应式支持。

## 抽取仅依赖 State 的配置

只访问 State 时使用 `PersistenceOptions<State>`：

```ts title="extracted.ts"
import { defineStore } from 'pinia-react'
import type { PersistenceOptions } from '@pinia-react/persistedstate'

interface PreferencesState {
  theme: string
  compact: boolean
}
const persistence: PersistenceOptions<PreferencesState> = {
  pick: ['theme'],
  afterHydrate({ store }) {
    const theme: string = store.theme
    console.info(theme)
  }
}

export const preferences = defineStore('preferences', {
  state: (): PreferencesState => ({ theme: 'light', compact: false }),
  getters: { label: state => `${state.theme}:${state.compact}` },
  persist: persistence
})
const label: string = preferences.getStore().label
void label
```

显式 State-only 配置的回调不知道 Getter / Action，但它**不会抹掉**最终 Store 自己的 Getter / Action 推导。

共享配置或工具已知完整 Store 类型时，可以提供第二个泛型：

```ts title="typed-options.ts"
import type { PersistenceOptions } from '@pinia-react/persistedstate'
import type { getCounterStore } from './counter'

type CounterStore = ReturnType<typeof getCounterStore>
export const counterPersistence: PersistenceOptions<CounterStore['$state'], CounterStore> = {
  pick: ['preferences.theme'],
  afterHydrate({ store }) {
    const double: number = store.double
    console.info(double)
  },
  onPersistError(_error, store) {
    const increment: (amount: number) => number = store.increment
    console.warn(store.$id, typeof increment)
  }
}
```

这里复用的是前面已经定义的 `counter.ts`。不要用**自身尚未完成推导的定义**的返回类型标注该 Store 初始化器，否则会形成循环类型依赖。这种场景优先保留内联推导。

## 全局回调保持泛型

工厂服务于形状不同的多个 Store，无法推导某个特定 Store 的 Getter 或 Action 名称：

```ts title="global.ts"
import { createPersistedState, type PluginOptions } from '@pinia-react/persistedstate'

const options: PluginOptions = {
  afterHydrate({ store }) { console.info(store.$id) },
  onPersistError(error, store) { console.warn(error.name, store.$id) }
}
export const persistence = createPersistedState(options)
```

全局回调适合跨 Store 行为和元信息。依赖具体形状的逻辑应放入 Store 自己的回调，不要把全局泛型 Store 强行断言成某个具体 Store。

## 可选的手动方法

公开 Store 类型上的 `$hydrate` / `$persist` 都是可选的，即使 `persist: true` 也一样。模块扩展还会影响未启用持久化和未注册插件的 Store，声明为必有方法会作出不安全的承诺。

```ts title="methods.ts"
import { getCounterStore } from './counter'

const counter = getCounterStore()
counter.$hydrate?.({ runHooks: false })
counter.$persist?.()
if (counter.$persist) counter.$persist()
```

不要用非空断言掩盖漏注册。导入类型只启用配置类型，不会安装运行时插件；仍需像[快速入门](../persistedstate)那样在创建 Store 前注册。

## 公开类型

| 类型 | 用途 |
| --- | --- |
| `StorageLike` | 同步 `getItem` / `setItem` 适配器 |
| `Serializer` | 同步快照序列化器，输入不一定是完整 State |
| `PersistenceOptions<S, StoreType>` | 单策略，可仅推导 State 或完整 Store |
| `PersistenceContext<S, StoreType>` | Store 级恢复钩子上下文 |
| `Persist<S, StoreType>` | 布尔值、单策略或只读策略数组联合 |
| `PluginOptions` | 工厂默认值、全局回调、`key` 转换及 `auto` |
| `HydrateOptions` | 手动恢复的 `runHooks` 选项 |
| `StatePath<S>` | State 路径建议，不是严格校验 schema |

## Next.js Cookie 入口

`@pinia-react/persistedstate/next` 导出 `createCookiePersistedState`、`readCookieSnapshot`、`CookieSnapshot`、`CookieReader`、`CookieOptions` 和 `CookiePersistenceOptions`，并加载同一份 Store 选项扩展。Cookie 工厂要求显式请求快照，提供 Cookie 属性补全，不接受其他工厂 storage 或 HttpOnly 选项。内联 Store 回调保留上面的推导，完整示例见 [Next.js 接入](./nextjs)。
