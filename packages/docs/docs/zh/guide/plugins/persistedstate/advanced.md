# 进阶用法

## 全局默认值

默认导出等价于无参 `createPersistedState()`。工厂可共享默认值；**选择一种**插件注册，不要同时注册默认插件和工厂结果。

```ts title="global.ts"
import { createPinia, defineStore } from 'pinia-react'
import { createPersistedState } from '@pinia-react/persistedstate'

const persistence = createPersistedState({
  storage: sessionStorage,
  debug: true,
  afterHydrate({ store }) { console.info(`Restored ${store.$id}`) }
})
createPinia().use(persistence)

export const preferences = defineStore('preferences', {
  state: () => ({ theme: 'light' }),
  persist: { debug: false } // 继承 storage 和钩子，仅覆盖 debug。
})
```

显式使用 `sessionStorage` 的示例仅适用于浏览器。Store 的钩子或错误回调会替换对应全局回调，不会叠加执行。`pick` / `omit` 按策略配置，没有全局默认值。详见[选项速查](./configuration#选项速查)。

客户端渲染的 Provider 应用应把工厂结果传给 `plugins={[persistence]}`，而非另外调用 `createPinia().use(...)`。Provider 的插件属性仅初始化时生效，配置应在该 Provider 生命周期内保持稳定。

## 自动启用

```ts title="auto.ts"
import { createPinia, defineStore } from 'pinia-react'
import { createPersistedState } from '@pinia-react/persistedstate'

createPinia().use(createPersistedState({ auto: true }))

export const appearance = defineStore('appearance', {
  state: () => ({ theme: 'light' }) // 由 auto 启用。
})
export const temporary = defineStore('temporary', {
  state: () => ({ search: '' }),
  persist: false // 明确关闭，不读写，也没有手动方法。
})
```

`auto` 默认 `false`。包含临时或私密字段的 Store 应优先显式启用或收窄 `pick`。开启 `auto: true` 后，所有没有显式覆盖的 Store 都会保存完整 State。

## 全局 key

工厂转换的是**已解析的策略 key**，也包括自定义策略 key：

```ts title="keys.ts"
import { createPinia, defineStore } from 'pinia-react'
import { createPersistedState } from '@pinia-react/persistedstate'

createPinia().use(createPersistedState({ key: key => `app:${key}` }))
export const preferences = defineStore('preferences', {
  state: () => ({ theme: 'light' }),
  persist: { key: id => `${id}:appearance` }
})
```

最终 key 是 `app:preferences:appearance`：Store ID → 策略 key → 全局转换。每条策略成功解析后缓存 key。Pinia 内存隔离不等于外部存储隔离；多个实例不应共享数据时，要使用不同 key。

## 多策略

用数组把字段放入不同存储，或有意分层恢复数据：

```ts title="strategies.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const workspace = defineStore('workspace', {
  state: () => ({ theme: 'light', locale: 'en', draft: '' }),
  persist: [
    { key: 'workspace:preferences', storage: localStorage, pick: ['theme', 'locale'] },
    { key: 'workspace:session', storage: sessionStorage, pick: ['theme', 'draft'] }
  ]
})
```

这个仅用于浏览器的示例先恢复第一条，再恢复第二条。假设 localStorage 保存 `{ "theme": "dark", "locale": "fr" }`，sessionStorage 保存 `{ "theme": "light", "draft": "hello" }`，最终 State 是 `{ theme: 'light', locale: 'fr', draft: 'hello' }`。重叠字段以后成功恢复的策略为准，未包含字段保留当前值。

保存时，**每条策略**按相同顺序从最终当前 State 筛选并序列化。相同 storage/key 的策略会互相覆盖，最后一次成功写入生效，而不是自动合并为一条记录。某条失败不阻止其他策略，也不回滚之前的恢复。除非确实需要覆盖，否则请用不同 key。

## 手动方法

```ts title="manual.ts"
import { createPinia, defineStore } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'

createPinia().use(persistedState)
const { getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  persist: true
})
const counter = getCounterStore()

counter.$persist?.() // 立即保存全部策略，不产生状态提交。
counter.$hydrate?.() // 恢复全部策略，默认运行钩子。
counter.$hydrate?.({ runHooks: false }) // 只跳过钩子，不关闭错误回调。
```

| 方法 | 契约 |
| --- | --- |
| `$persist(): void` | 立即保存策略，不产生状态提交或订阅通知 |
| `$hydrate(options?: HydrateOptions): void` | 逐策略读取、校验、筛选、合并与恢复 |
| `options.runHooks` | 默认 `true`，`false` 只跳过前后钩子 |

两个方法在 TypeScript 中都是可选的，因为未启用的 Store、插件注册前已创建的 Store 并没有它们。使用可选链或先缩窄判断。`persist: []` 安装空操作方法。失败通过配置的错误回调报告，方法不返回成功标记。

## 恢复与回写隔离

首次创建和手动恢复遵循同一组规则：

1. 整轮恢复期间，暂停该 Store 的自动保存。
2. 按顺序执行策略及钩子；每次成功恢复都通过受控 Mutation 提交，origin 为 `@pinia-react/persistedstate`。
3. 即使失败，也在 `finally` 中解除自动保存暂停。

首次恢复的全部策略完成前，不会发生自动回写。恢复期间钩子或错误回调产生的提交也不会自动保存。正在恢复时嵌套调用 `$hydrate()` 会被忽略。后续业务提交或显式 `$persist()` 才会保存当前 State；显式保存不是自动回写，不应在钩子里递归调用。

这是回写隔离，**不是事务**：观察者可以看到逐次恢复的状态，后续失败也不会撤销前面成功的恢复。核心 State、Getter 缓存、订阅和 React 快照仍遵循正常 Mutation 生命周期。一个 Store 的恢复不暂停其他 Store 或 Pinia 实例。

## 重置不等于删除

普通 `$reset()` 恢复工厂默认值，并把默认值保存到存储，**不会删除** key。确需删除 Web Storage 条目时，由应用显式操作最终 key：

```ts title="remove.ts"
import { createPinia, defineStore } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'

createPinia().use(persistedState)
const { getSettingsStore } = defineStore('settings', {
  state: () => ({ theme: 'light' }),
  persist: { key: 'app:settings' }
})
const settings = getSettingsStore()

export function forgetSettings() {
  settings.$reset() // 先写入默认值。
  localStorage.removeItem('app:settings') // 仅浏览器，由应用显式操作。
}
```

`removeItem` 异常由应用处理，不属于插件错误回调。应先重置再删除，否则重置会重新写入。后续真实提交仍会重新创建条目；key 缺失时 `$hydrate()` 保留当前 State。多策略需要分别考虑每个 storage 和最终转换后的 key。插件不提供清空或删除 API。

## DevTools

DevTools 时间旅行与 DevTools reset 都是真实提交，默认**更新持久化数据**。插件仅排除自身恢复 origin 和正在恢复的整轮提交，不排除全部 DevTools 提交。两种插件注册顺序均可，DevTools 适配器会过滤自身消息，避免协议循环。

保存大载荷、非 JSON 值或接入服务端渲染前，请阅读[限制](./limitations)。
