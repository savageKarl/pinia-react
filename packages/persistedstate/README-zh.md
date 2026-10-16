# @pinia-react/persistedstate

`pinia-react` 的独立同步持久化插件，不依赖 Vue / Nuxt。

```sh
pnpm add pinia-react @pinia-react/persistedstate
```

```ts
import { createPinia, defineStore } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'

createPinia().use(persistedState)
export const { useSettingsStore, getSettingsStore } = defineStore('settings', {
  state: () => ({ theme: 'light' }),
  persist: true,
})
getSettingsStore().$persist?.()
```

`createPersistedState` 提供全局默认值、`auto`、key 命名空间、自定义同步 storage / serializer 和钩子。`persist` 可为布尔值、单策略或带嵌套 `pick` / `omit` 的有序策略数组。`$hydrate({ runHooks })`、`$persist()` 仅存在于启用的 Store，类型声明为可选。React SPA 可向 `PiniaProvider` 传入仅初始化生效的 `plugins={[persistedState]}`。

普通对象递归合并，数组整体替换，null 可以覆盖，未保存字段保留。全部策略恢复后才开始自动回写。异常按策略隔离；普通重置和 DevTools 时间旅行会更新存储。默认只保证 JSON 可表达数据，不提供异步存储、TTL、迁移或加密；Cookie 持久化由独立 Next.js 入口提供。

无 `window` 时安全导入、跳过默认存储，不等于默认入口可直接用于 SSR；App Router 服务端偏好请用独立的 `@pinia-react/persistedstate/next` Cookie 适配器。不要保存敏感凭证。

[完整中文指南](https://savagekarl.github.io/pinia-react/zh/guide/plugins/persistedstate) · [English guide](https://savagekarl.github.io/pinia-react/guide/plugins/persistedstate)

## 使用文档

- [快速入门](https://savagekarl.github.io/pinia-react/zh/guide/plugins/persistedstate)：浏览器 SPA、Provider 与非 Hook 接入。
- [配置](https://savagekarl.github.io/pinia-react/zh/guide/plugins/persistedstate/configuration)：默认值、优先级与字段筛选。
- [进阶用法](https://savagekarl.github.io/pinia-react/zh/guide/plugins/persistedstate/advanced)：全局 key、有序策略与手动 API。
- [TypeScript](https://savagekarl.github.io/pinia-react/zh/guide/plugins/persistedstate/typescript)：钩子及错误回调推导、路径补全与配置抽取。
- [限制与注意事项](https://savagekarl.github.io/pinia-react/zh/guide/plugins/persistedstate/limitations)：序列化、存储异常与 SSR 边界。
- [Next.js Cookie 持久化](https://savagekarl.github.io/pinia-react/zh/guide/plugins/persistedstate/nextjs)：请求快照、SSR 水合与浏览器保存。
