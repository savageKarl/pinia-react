# 什么是 Pinia-React？

Pinia-React 用三部分管理 React 共享状态：

- **State** 保存数据。
- **Getter** 计算并缓存派生值。
- **Action** 修改 State，组织包含异步操作的业务逻辑。

组件通过 Hook 读取 Store。读取路径会自动追踪，用于过滤不相关的 Store 订阅更新。Action 内使用 Immer 语法进行不可变更新，公开 State 保持只读。

业务域和具名派生值能让应用更好理解时，可以采用这种结构。组件局部状态先用 `useState` 或 `useReducer`。如果更喜欢显式订阅和灵活的 state creator，Zustand 提供了更小的 selector 模型，见[对比指南](../integrations/compare-zustand)。

自动追踪有运行时开销，不能阻止父组件、props、Context 或 Strict Mode 引起的渲染，不保证总渲染成本更低。

## 从一个 Store 开始

按[快速开始](./getting-started)初始化浏览器应用，定义一个 Store，再阅读 [State](../core-concepts/state)、[Getter](../core-concepts/getters) 和 [Action](../core-concepts/actions)。

Provider、多实例、SSR 和插件按需使用。组件外服务需要显式实例时，见[组件外访问](../core-concepts/outside-component-usage)；请求快照见 [Next.js](../integrations/nextjs)。持久化和 Redux DevTools 是独立包。

## 支持边界

这里提供选项式 Store API，不是 Vue Pinia 兼容层。Setup Store、selector API、Store 热更新、异步持久化、跨标签页同步和自动 schema 迁移不在支持范围。特殊对象保留原生读取兼容，但不获得透明响应式修改能力，详见 [State](../core-concepts/state)。
