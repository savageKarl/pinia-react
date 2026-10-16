# Next.js：Cookie 持久化

当小型偏好需要直接体现在服务端 HTML 中时，使用 `@pinia-react/persistedstate/next`。服务端读取白名单 Cookie 快照，客户端 Provider 在返回 Store 前恢复**同一份快照**，首次水合不会另读浏览器里更新的 Cookie。

此入口支持 Next.js App Router 的根 Provider 接入，不会让默认 `localStorage` 插件自动获得 SSR 支持。较大草稿请使用其他存储层；浏览器可读 Cookie 不适合保存凭证。

## 1. 声明最终 Cookie key

共享模块只保存名称，不放请求数据。这里填写 Store key 函数与全局 key 转换**之后的最终 key**：

```ts title="app/persistence.ts"
export const preferenceCookieKeys = ['app:preferences'] as const
```

## 2. 在客户端 Provider 内创建插件

```tsx title="app/providers.tsx"
'use client'

import type { ReactNode } from 'react'
import { PiniaProvider } from 'pinia-react/next'
import { createCookiePersistedState, type CookieSnapshot } from '@pinia-react/persistedstate/next'

export function Providers({ children, cookies }: { children: ReactNode; cookies: CookieSnapshot }) {
  const persistence = createCookiePersistedState({
    cookies,
    cookieOptions: { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 }
  })
  return <PiniaProvider plugins={[persistence]}>{children}</PiniaProvider>
}
```

插件保留当前请求快照的副本。Provider 属性只在初始化时生效，重渲染不重复安装、不重新恢复。应在该边界内创建插件，不要让进程级全局插件保存请求数据。函数留在 Client Component 内，服务端与客户端之间只传普通序列化数据。

## 3. 服务端 Layout 读取请求

```tsx title="app/layout.tsx"
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { readCookieSnapshot } from '@pinia-react/persistedstate/next'
import { preferenceCookieKeys } from './persistence'
import { Providers } from './providers'

export default async function Layout({ children }: { children: ReactNode }) {
  const snapshot = readCookieSnapshot(await cookies(), preferenceCookieKeys)
  return (
    <html lang='en'>
      <body><Providers cookies={snapshot}>{children}</Providers></body>
    </html>
  )
}
```

在这里等待 Next.js 的 `cookies()`，而非在 Store 创建中引入异步。读取请求 Cookie 会让路由依赖当前请求，应按所用 Next.js 版本考虑缓存与渲染规则。`readCookieSnapshot` 只对编码后的白名单名称调用 `get`，保持 **Next.js 已解码的值**不变，不要再次解码，否则 `%20` 等原始文字会被改变。

不要把所有请求 Cookie 传进 Client Component，否则可能泄露无关凭证，甚至服务端读到的 HttpOnly Cookie。此工具刻意要求显式列出偏好 key。reader 抛错时由服务端边界处理；策略错误回调从创建 Store 时才开始生效。

## 4. 启用 Store

```tsx title="app/preferences.tsx"
'use client'

import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate/next'

export const { usePreferencesStore } = defineStore('preferences', {
  state: () => ({ theme: 'light', locale: 'en' }),
  getters: { label: state => `${state.theme}:${state.locale}` },
  actions: {
    toggleTheme() { this.theme = this.theme === 'light' ? 'dark' : 'light' }
  },
  persist: { key: 'app:preferences', pick: ['theme', 'locale'] }
})

export function Preferences() {
  const preferences = usePreferencesStore()
  return <button onClick={() => preferences.toggleTheme()}>{preferences.label}</button>
}
```

在 Layout 下的页面渲染 `Preferences`。切换主题后刷新：服务端 HTML 已采用保存的主题，客户端首次渲染也一致，不需要等 effect 才从默认主题切换到保存主题。

## 快照与生命周期

| 操作 | 行为 |
| --- | --- |
| 服务端、客户端首次创建 Store | 仅从传入的请求快照恢复 |
| key 缺失，包括未加入白名单 | 保留当前默认值 / initialStores，不读取更新的浏览器数据 |
| 同时提供 `initialStores` 和 Cookie | 先采用现有完整 initialStores 快照，再由插件筛选并合并 Cookie 字段 |
| 后续才创建的惰性 Store | 首次恢复仍采用 Provider 保存的请求快照 |
| 浏览器 Action、`$patch`、`$reset`、DevTools 提交 | 把选中字段保存到浏览器 Cookie |
| 浏览器 `$persist()` | 立即保存，遵循正常错误和容量限制 |
| 浏览器 `$hydrate()` | 显式重读当前浏览器 Cookie，应在该消费者水合后的事件或 effect 中使用 |
| 服务端保存 | 不写响应 Cookie，内存业务提交仍然有效 |
| 服务端 `$hydrate()` | 重新读取已捕获的请求快照 |
| 同一 Provider 下导航 / `router.refresh()` | 保留实例和客户端修改，新属性不重放请求数据 |
| 整页刷新或 Provider 重挂 | 新实例采用新传入的快照 |

首次恢复保留通用插件的策略顺序、钩子、安全校验、对象递归合并、数组替换、`null` 覆盖和整轮回写隔离，不发生初始 Cookie 写入。读取旧水合快照不会把它反向提交，更不会覆盖用户的新操作。延迟 Suspense 消费者先使用初始渲染快照，再追上当前 State / Getter。

请求白名单中没有的惰性 Store 使用默认值，这是有意的行为。SSR 持久化 Store 的 key 要提前列出。切换账号需明确划分 Provider 生命周期；普通刷新不会替换当前用户状态。工厂默认值应确定，服务端和客户端应使用相同 initialStores；适配器不能修复随时间变化的任意初始化逻辑。

## 工厂与 Cookie 选项

`createCookiePersistedState(options): PiniaPlugin` 必须提供 `cookies: CookieSnapshot`，其余支持通用工厂的 `auto`、全局 `key`、`serializer`、`debug`、钩子和错误回调。Store 的 `persist` 仍可为布尔、单配置、有序数组，并保持 State / Getter / Action 推导。全局与策略 key 按[相同规则组合](./advanced#全局-key)。

它是 **Cookie 专用**插件。工厂类型不接受 `storage`，策略覆盖 `storage` 会报告该策略错误，不会访问那个存储。不要在同一 Store 上同时注册它和默认持久化插件，否则会建立两套独立生命周期。localStorage / 异步策略需要另行明确设计 SSR 接入。

| `cookieOptions` | 默认值 | 含义 |
| --- | --- | --- |
| `path?: string` | `/` | 可见路径，跨页面共享时使用 `/` |
| `domain?: string` | 省略 | 仅当前主机；显式 Domain 必须适用于当前域 |
| `maxAge?: number` | 省略 | 会话 Cookie；非负安全整数秒，`0` 表示立即过期 |
| `sameSite?: 'lax' \| 'strict' \| 'none'` | `'lax'` | `none` 必须配合 Secure |
| `secure?: boolean` | HTTPS 时 `true`，否则 `false` | 开启后只通过 HTTPS 发送 |

浏览器写入时对 Cookie key 和 value 各做一次 URI 编码。`readCookieSnapshot` 选择相应的编码名称，返回对象用逻辑原始 key。Cookie 持久化不接受空 key，并检查 `__Secure-` / `__Host-` 前缀约束。偏好必须能由浏览器 JavaScript 写入，因此不能配置 HttpOnly。

**含属性共超过 4096 个编码字节**的赋值会被拒绝，通过 `onPersistError` 报告，不撤销业务提交。保持字段小；浏览器仍可能因 Domain、策略、总配额或访问限制静默拒绝 Cookie，setter 没抛错不证明数据持久保存。服务端后续更新时要用相同 Path / Domain，避免不同路径存在同名 Cookie。

## 服务端修改与支持边界

Server Component 渲染不会通过此插件写响应 Cookie。服务端修改应使用 Next.js 允许写入的边界（Server Action / Route Handler）；如果这样做，使用完全一致的编码 Cookie 名称、序列化值和属性，并明确决定当前 Provider 是重挂还是显式更新。单独 `router.refresh()` 不会重新初始化它。

这是偏好持久化适配器，不是认证 / Session 管理、localStorage hydration 方案、Pages Router 集成、迁移、跨标签同步或自动把 Cookie 变成服务端 Mutation 的桥接。客户端可控 Cookie 不可信，业务数据应在 `deserialize` 中校验。通用行为仍见[限制](./limitations)与[配置](./configuration)。
