# 限制与注意事项

持久化适合小型、可序列化的客户端偏好，不是数据库、安全边界或完整 SSR 适配器。先理解这些限制，可以避免刷新后数据变化或 UI 不一致。

## 同步存储与写入成本

插件在同步创建 Store 时恢复，在真实 Mutation 提交时保存，因此 `getItem`、`setItem`、序列化方法和钩子必须同步。IndexedDB、返回 Promise 的适配器和异步钩子任务不会被等待，不能作为受支持的持久化策略。

每次真实提交都会对每条启用策略进行序列化并写入，没有内置批处理、防抖或重试调度。大快照和昂贵序列化会阻塞提交线程。请用 `pick` 只保存必要字段，保持载荷小；大型或异步数据应交给应用层的其他数据方案。保存异常不会回滚已成功的内存业务提交。

## 序列化与数据形状

默认格式是 JSON，适合普通对象、数组、字符串、有限数字、布尔值和 `null`，不适合任意 JavaScript 值：

| 值 | 预期与推荐表示 |
| --- | --- |
| `Date` | JSON 保存的是字符串，不会恢复为 `Date`；保存 ISO 字符串或时间戳 |
| `Map`、`Set`、类实例 | 不保证往返恢复，转换为普通可序列化数据 |
| `undefined`、函数、symbol | JSON 无法忠实保存，不要依赖它们作为持久化 State |
| `BigInt` | 默认 JSON 序列化失败 |
| `NaN`、无穷值 | JSON 无法保留原数值含义，应校验或规范化 |
| 循环普通对象或数组 | 被拒绝，用 ID 表达关联 |
| 共享对象引用 | 筛选、JSON、合并后不保留引用相等关系，用 ID 规范化 |

自定义序列化器改变数据格式，不扩展核心支持的响应式模型。尤其不要假定把字符串转成类实例，就能让实例获得深层响应式能力。

### 日期保留为可序列化状态

保存简单值，在展示或计算时派生 `Date`：

```ts title="dates.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const reminder = defineStore('reminder', {
  state: () => ({ dueAt: '2026-10-15T09:00:00.000Z' }),
  getters: { dueDate: state => new Date(state.dueAt) },
  actions: { reschedule(iso: string) { this.dueAt = iso } },
  persist: { pick: ['dueAt'] }
})
```

只有 `dueAt` 被保存。派生的 `Date` 应当作计算值，通过 Action 修改字符串，而非修改 Getter 的结果。输入日期字符串是否合法由应用按业务需要校验。

### 载荷校验不是业务 schema

插件要求普通对象载荷，拒绝危险 key（包括数组内部嵌套对象的危险 key），并拒绝普通对象或数组组成的循环。这**不代表**逐字段校验期望类型、删除所有未知字段或升级旧业务 schema。例如 `{ "count": "wrong" }` 仍是合法对象，可以覆盖数字默认值。

需要 schema 时，请在自定义 `deserialize` 中校验，不合法就抛错。收窄 `pick`，避免无关旧字段恢复。插件不提供自动迁移或带版本的 schema 系统。`Serializer` 类型只是同步返回对象的接口契约，不证明外部数据可信。

## 安全与存储失败

浏览器存储可被应用 JavaScript 读取，不是安全凭证保险箱。不要保存密码、敏感凭证或高度敏感的个人信息。插件不加密，也不管理认证 Cookie。`omit` 可减少误存，但不是访问控制边界；显式 `pick` 往往更易审计。

配额、隐私限制或访问不可用都可能导致存储失败，损坏 JSON、抛错的钩子和序列化器也会失败。通过 `onHydrateError` / `onPersistError` 接入应用报告，诊断时可启用 `debug`。错误回调自身也会被隔离，避免打断其他策略或核心 Mutation 分发。

读取、反序列化或载荷校验失败时不提交该载荷；钩子已产生的修改和已成功的恢复会保留，即使后钩子或后续策略失败也不回滚，恢复并非事务。没有自动备用存储、删除 key 或后台重试。不要在序列化器或错误回调中构造修改状态的重试循环。debug 避免输出载荷和异常消息，但应用自定义日志仍需自行防止敏感数据泄露。

## 服务端渲染与 Next.js

导入包本身不访问浏览器存储。无 `window` 时跳过默认存储操作，Store 仍可在内存中使用。显式提供同步 storage 时，服务端仍会执行它，其作用域和隔离由应用负责。

默认入口只提供基础服务端安全，不负责协调浏览器 localStorage 与 SSR 快照，不要把 SPA 用法直接用于 SSR 树。小型服务端可见偏好可使用独立的 [Next.js Cookie 适配器](./nextjs)：两端恢复同一请求快照，保留惰性 Store 初始化，并支持延迟 Suspense 水合。它不提供通用 localStorage SSR、认证或 Pages Router 支持。

## 实例与标签页边界

不同 Pinia / Provider 隔离内存状态和订阅，但配置相同 key 时仍共享外部存储。需要隔离时，使用带命名空间的不同 key。

其他标签页写入不会自动更新已创建的 Store。没有 `storage` 事件同步或冲突解决。之后手动 `$hydrate()` 可以按既有恢复规则重新读取，但这不是自动跨标签同步。

## 与参考库的范围关系

保留熟悉的默认插件与工厂、显式启用与 `auto`、key、同步存储与序列化、路径筛选、多策略、钩子和手动 API。React 快照、受控恢复 origin、整轮自动回写隔离、校验及可选方法类型，则遵循 Pinia-React 自身契约，不照搬 Vue 内部机制。

Vue setup Store 限制、Vue HMR 和 Nuxt 模块并非这里提供的功能。异步存储、跨标签同步、TTL、迁移和加密不在范围内；Cookie 仅由显式 Next.js 入口提供。已支持的能力请看[进阶用法](./advanced)；受支持的 App Router Cookie 路径单独见 [Next.js](./nextjs)。
