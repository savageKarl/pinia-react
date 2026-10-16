# 状态持久化

`@pinia-react/persistedstate` 是 Pinia-React 的独立同步持久化插件，让选中的状态在刷新页面后保留。从浏览器 `localStorage` 和 JSON 默认配置开始，再按需增加设置。

- Store 首次创建时恢复，后续每次真实状态提交后自动保存。
- 用嵌套 `pick` / `omit` 选择字段，或按顺序拆分到多个存储策略。
- 自定义同步存储、序列化、恢复钩子和错误处理。
- 同时适用于 React、非 Hook 的 `getStore` 和 `PiniaProvider`。

:::warning 先面向浏览器 SPA
下面的 React 接入适用于客户端渲染应用。服务端渲染的 App Router 页面请使用独立的 [Next.js Cookie 适配器](./persistedstate/nextjs)，默认 localStorage 插件不是 SSR 适配器。不要保存密码或敏感凭证。
:::

## 安装

在已有 React 应用中，同时安装核心库和插件：

```sh
pnpm add pinia-react @pinia-react/persistedstate
```

## 1. 为 Store 启用持久化

```ts title="src/stores/settings.ts"
import { defineStore } from 'pinia-react'

export const { useSettingsStore, getSettingsStore } = defineStore('settings', {
  state: () => ({ theme: 'light', compact: false }),
  actions: {
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
    }
  },
  persist: true
})
```

## 2. 在创建 Store 前注册插件

客户端渲染的 React 应用可以直接在 Provider 上注册：

```tsx title="src/main.tsx"
import { createRoot } from 'react-dom/client'
import { PiniaProvider } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <PiniaProvider plugins={[persistedState]}>
    <App />
  </PiniaProvider>
)
```

插件注册早于 Provider 内的 Store 创建。`plugins` **仅在初始化时生效**，重渲染不会重复注册或重新恢复。已有 `initialStores` 仍需提供完整快照；注册插件不改变原有快照和实例隔离语义。不要重复注册同一个插件。

## 3. 照常读取和修改

```tsx title="src/App.tsx"
import { useSettingsStore } from './stores/settings'

export function App() {
  const settings = useSettingsStore()
  return (
    <button onClick={() => settings.toggleTheme()}>
      Theme: {settings.theme}
    </button>
  )
}
```

点击按钮后刷新页面，可以看到状态保留。浏览器中的 `settings` key 内容例如：

```json
{"theme":"dark","compact":false}
```

已有数据会在**首次返回 Store 前**同步恢复。key 不存在时保留工厂默认值，不会立即写入。后续 Action（包括 `await` 后的修改）、两种 `$patch`、`$reset` 和 DevTools 提交都会触发保存；Getter 本身不参与持久化。

## 不使用 Provider 或 Hook

以下是**另一种入口**，不要与前面的 Provider 方案重复初始化：

```ts title="src/non-hook.ts"
import { createPinia } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'
import { getSettingsStore } from './stores/settings'

createPinia().use(persistedState)
const settings = getSettingsStore()
settings.toggleTheme()
```

先注册，再调用 `getStore` / `useStore`；后注册的插件不会补装到已经创建的 Store。不同 Pinia / Provider 隔离内存状态，但不会隔离刻意共用的外部 storage key。

## 接下来读什么

| 目标 | 文档 |
| --- | --- |
| 更换 key、存储、序列化或筛选字段 | [配置](./persistedstate/configuration) |
| 设置全局默认值、多策略或手动保存与恢复 | [进阶用法](./persistedstate/advanced) |
| 理解补全、回调推导与配置抽取 | [TypeScript](./persistedstate/typescript) |
| 理解序列化、异常与服务端边界 | [限制与注意事项](./persistedstate/limitations) |

本指南借鉴 [pinia-plugin-persistedstate](https://praz.codeberg.page/pinia-plugin-persistedstate/guide/) 的内容组织方式；示例和行为以 Pinia-React 自身契约为准，不包含 Vue / Nuxt 集成。

需要服务端首屏偏好时，阅读 [Next.js：Cookie 持久化](./persistedstate/nextjs)。

## 操作 API 演示

在仓库根目录运行 `pnpm playground-react`，体验默认插件与工厂、筛选、多策略、序列化、手动方法、钩子、错误和 DevTools；运行 `pnpm playground-nextjs`，体验 Cookie 快照、惰性 Store、显式恢复和可控制的延迟水合。两者都显示存储和事件日志，逐项操作说明见仓库 `packages/playground/PERSISTENCE_DEMOS.md`。
