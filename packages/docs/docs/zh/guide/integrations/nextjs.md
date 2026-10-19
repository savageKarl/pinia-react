# Next.js App Router

在共享布局中使用一个根级 PiniaProvider，确保客户端导航时它保持挂载。Server Component 获取请求数据，并按 Store ID 组织为普通 JSON 传入。useCounterStore 等 Hook 在 Client Component 中调用。

```tsx
// app/layout.tsx — Server Component
import { PiniaProvider } from 'pinia-react/next'
import type { ReactNode } from 'react'

export default async function Layout({ children }: { children: ReactNode }) {
  // 将示例替换为当前请求对应的 API 或数据库查询。
  const counter = await Promise.resolve({ count: 10 })
  return (
    <html lang='zh'>
      <body>
        <PiniaProvider initialStores={{ counter }}>{children}</PiniaProvider>
      </body>
    </html>
  )
}
```

```tsx
// app/counter.tsx — Client Component
'use client'
import { defineStore } from 'pinia-react'

export const { useCounterStore, getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: { increment() { this.count++ } }
})

export function Counter() {
  const store = useCounterStore()
  return <button onClick={() => store.increment()}>{store.count}</button>
}
```

## 初始化与生命周期

initialStores 是以 defineStore 的精确 ID 为键的容器。传入的每个 Store 都需要完整的 JSON 状态快照；未提供快照的 Store 使用自己的 state() 默认值。不会深度合并。快照在 Store 首次创建时惰性消费，并在插件运行前完成初始化，此时 pinia.state 已包含初始状态。

Provider 在其生命周期内持有同一个 Pinia 实例。普通属性更新、router.refresh() 和同一布局下的客户端导航都不会重新应用快照或覆盖客户端修改。卸载并重新挂载 Provider 会创建新实例。$reset 恢复 state 工厂默认值，而不是服务端快照。

Hook 优先使用最近的 Provider Context，其次是 active Pinia。浏览器 Provider 也设置 active Pinia，以兼容单根应用的无参访问函数。普通访问函数不读取 Context。多个客户端根并存时，在各自应用边界保留显式实例，传给服务或通过业务服务闭包保留；`await` 前后使用同一实例，不要把全局 active Pinia 当作请求容器。见[多实例访问](../core-concepts/outside-component-usage)。

## 服务端与客户端边界

Provider 在服务端渲染时创建隔离的实例，不设置进程级 activePinia。不要在模块顶层创建保存请求或用户数据的共享 Pinia。Server Component 查询数据并渲染 Provider，不直接调用 Store Hook 或 getCounterStore()。只传 JSON，不传 Pinia 实例、Store、Proxy、Action、Getter 或 Immer Draft。

状态推荐使用字符串、有限数字、布尔值、null、普通对象和数组。日期等领域对象应先转换为 JSON。Date、Map、Set、class 实例、函数和浏览器对象的响应式修改与传输语义不作保证。

## 插件与持久化

通过仅初始化生效的 `plugins?: readonly PiniaPlugin[]` 在创建 Store 前注册插件。需要直接体现在服务端 HTML 中的小型偏好时，使用显式的 [Next.js Cookie 持久化适配器](../plugins/persistedstate/nextjs)：在服务端 Layout 等待请求 Cookie，只传白名单偏好值，再由 Client Provider 创建 Cookie 插件。两端恢复同一份请求快照，浏览器提交保存 Cookie，服务端渲染不写响应 Cookie。

默认 localStorage 插件仍面向浏览器 SPA，不支持直接注册到 SSR 树。核心 Provider 不读取存储、不决定业务数据优先级；Cookie 适配器在 initialStores 之后合并选中字段。导航和 router.refresh() 保留已有 Provider，不重放请求数据。
