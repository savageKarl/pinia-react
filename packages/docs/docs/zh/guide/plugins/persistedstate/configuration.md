# 配置

在 `defineStore({ persist: ... })` 中设置单个 Store 的选项。先注册默认插件或[工厂创建的插件](./advanced#全局默认值)，再创建 Store。

## 启用与关闭

| `persist` | 行为 |
| --- | --- |
| 省略 | 默认关闭；工厂设置 `auto: true` 时启用 |
| `false` | 明确关闭，覆盖 `auto: true`；没有手动方法 |
| `true` 或 `{}` | 使用默认值的一条策略 |
| 配置对象 | 一条自定义策略 |
| 配置对象数组 | 按数组顺序执行多条策略 |
| `[]` | 已启用但没有策略：手动方法为空操作，不建立订阅 |

## 选项速查

Store 选项优先于同名全局默认值；回调是替换，不是叠加。`pick` / `omit` 仅用于策略。全局 `key` 转换在每条策略解析自己的 key **之后**执行，并非被策略 key 覆盖。

| 选项 | 类型 | 默认值 | 可设全局默认值？ |
| --- | --- | --- | --- |
| `key` | `string \| (storeId: string) => string` | Store ID | 仅全局转换函数，见[全局 key](./advanced#全局-key) |
| `storage` | `StorageLike` | 浏览器 `localStorage` | 是 |
| `serializer` | `Serializer` | `JSON.stringify` / `JSON.parse` | 是 |
| `pick` | `readonly string[]`，提供 State 路径补全 | 全部 State 字段 | 否 |
| `omit` | `readonly string[]`，提供 State 路径补全 | 不排除字段 | 否 |
| `beforeHydrate` | `(context) => void` | 无 | 是 |
| `afterHydrate` | `(context) => void` | 无 | 是 |
| `onHydrateError` | `(error: Error, store) => void` | 无 | 是 |
| `onPersistError` | `(error: Error, store) => void` | 无 | 是 |
| `debug` | `boolean` | `false` | 是 |

`auto: boolean` 只属于 `createPersistedState`，默认 `false`。Store 内回调推导该 Store 的 State、Getter 和 Action；全局回调保持泛型。详见 [TypeScript](./typescript)。

## key

默认情况下，`defineStore('preferences', ...)` 使用 `preferences` key。可以给固定字符串，也可以根据 Store ID 计算：

```ts title="key.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const preferences = defineStore('preferences', {
  state: () => ({ theme: 'light' }),
  persist: { key: id => `my-app:${id}` }
})
```

没有全局转换时，最终 key 为 `my-app:preferences`。空字符串也是合法 key。key 成功解析后会缓存，不是响应式切换用户或账号的机制。需要账号隔离时，应明确设计 Store 生命周期和 key 命名空间，而非捕获不断变化的用户 ID。

## storage

希望数据只保留在当前标签页会话，可以改用浏览器 `sessionStorage`：

```ts title="session.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const draft = defineStore('draft', {
  state: () => ({ text: '' }),
  persist: { storage: sessionStorage }
})
```

此示例仅用于浏览器：模块求值时访问 `sessionStorage` 是示例代码自己引入的浏览器依赖。插件默认存储则是延迟解析的，无 `window` 时可安全跳过。

自定义适配器只需**同步** `getItem` / `setItem`；key 不存在时返回 `null`，无需实现 `removeItem`：

```ts title="memory.ts"
import { createPinia } from 'pinia-react'
import { createPersistedState, type StorageLike } from '@pinia-react/persistedstate'

const values = new Map<string, string>()
export const memoryStorage: StorageLike = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => { values.set(key, value) }
}

createPinia().use(createPersistedState({ storage: memoryStorage }))
```

内存适配器适合测试或明确限定作用域的非浏览器应用，不会在进程重启后保留数据。不支持 IndexedDB 等异步适配器，原因见[同步存储限制](./limitations#同步存储与写入成本)。

## serializer

序列化器拿到的是**筛选后的独立快照**，不一定是完整 State。两个方法都必须同步；`serialize` 返回字符串，`deserialize` 返回对象。例如，保留 JSON 数据格式，仅增加缩进方便阅读：

```ts title="serializer.ts"
import { defineStore } from 'pinia-react'
import { type Serializer } from '@pinia-react/persistedstate'

const readableJson: Serializer = {
  serialize: state => JSON.stringify(state, null, 2),
  deserialize: JSON.parse
}

export const appearance = defineStore('appearance', {
  state: () => ({ theme: 'light', temporaryPanel: false }),
  persist: { serializer: readableJson, pick: ['theme'] }
})
```

传给 `serialize` 的只有 `{ theme: 'light' }`，结果是带缩进的 JSON。不要在序列化器中修改应用状态。自定义序列化不会扩展核心对任意类实例的响应式支持，也不保证业务数据合法，详见[数据限制](./limitations#序列化与数据形状)。

## pick / omit

路径按点号分隔**普通对象**属性。数组作为整个字段处理：选 `items`，不要选 `items.0.name`。Getter 和 Action 不是 State 字段。

```ts title="selection.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const editor = defineStore('editor', {
  state: () => ({
    preferences: { theme: 'light', locale: 'en', preview: false },
    items: ['one', 'two'],
    dialogOpen: false
  }),
  persist: {
    pick: ['preferences', 'items'],
    omit: ['preferences.preview']
  }
})
```

选出的快照为：

```json
{"preferences":{"theme":"light","locale":"en"},"items":["one","two"]}
```

- **读取和写入**都先 `pick` 再 `omit`。旧存储中今天已被排除的字段不会恢复。
- 省略 `pick` 表示全部 State；`pick: []` 选择空对象；`omit: []` 不排除字段。
- 路径不存在时忽略；空路径段及 `__proto__`、`constructor`、`prototype` 路径段会被拒绝。字段名本身含点号时无法通过这种路径访问。
- 恢复时普通对象递归合并、数组整体替换、`null` 可以覆盖，未保存的默认字段保留。这**不改变**核心 `$patch` 的浅合并语义。

例如，工厂状态为 `{ preferences: { theme: 'light', locale: 'en' }, items: ['a'] }`，存储为 `{ preferences: { theme: 'dark' }, items: [] }`，恢复结果就是 `{ preferences: { theme: 'dark', locale: 'en' }, items: [] }`。

## beforeHydrate / afterHydrate

每条策略按 `beforeHydrate → 读取 → 反序列化/筛选/合并/恢复 → afterHydrate` 执行。key 不存在仍运行两个钩子；策略失败会跳过自己的 `afterHydrate` 并报告恢复错误，后续策略继续。

```ts title="hooks.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const counter = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: { double: state => state.count * 2 },
  persist: {
    beforeHydrate({ store }) { console.info(`Restoring ${store.$id}`) },
    afterHydrate({ store }) { console.info(`Restored double: ${store.double}`) }
  }
})
```

钩子是同步的，不会等待返回的 Promise。首次恢复的钩子执行时，插件返回的 `$hydrate` / `$persist` 尚未安装；使用传入的上下文，不要假定这些方法已经可用。通过 Action 或 `$patch` 修改状态，不要写入只读 `$state`。

**全部**策略和钩子完成前，自动回写一直暂停，手动恢复也一样。钩子修改先留在内存，后续真实提交或显式 `$persist()` 才会保存，详见[恢复期隔离](./advanced#恢复与回写隔离)。

## 错误与 debug

```ts title="errors.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const settings = defineStore('settings', {
  state: () => ({ theme: 'light' }),
  persist: {
    debug: true,
    onHydrateError(_error, store) { console.warn(`Could not restore ${store.$id}`) },
    onPersistError(_error, store) { console.warn(`Could not save ${store.$id}`) }
  }
})
```

回调收到规范化的 `Error` 和当前 Store。key 解析、存储访问、序列化、校验或钩子异常均按策略隔离，错误回调自身抛错也被隔离。保存失败不会回滚业务提交。debug 只输出操作和 Store 标识，不打印载荷或异常消息。没有备用存储、自动删除、定时重试或 schema 迁移。不要在错误回调里递归触发保存。
