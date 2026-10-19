# 选择状态模型

从谁持有状态开始，不按功能清单选型。

| 场景 | 合理起点 |
| --- | --- |
| 一个表单或临时 UI | 局部 `useState` / `useReducer`；后代需要时用 Context 传递 |
| 已有 Redux Toolkit 和 RTK Query 应用 | 没有具体迁移理由时，保留 reducer、middleware 和服务端缓存约定 |
| 小型共享状态与显式依赖 | Zustand creator 和 selector |
| 相关业务域与具名派生值 | Pinia-React 选项式 Store、缓存 Getter 和 Action |
| SSR 或多个挂载应用 | 不论用哪种库，都需要请求快照和有作用域的实例 |
| 原始更新开销很关键 | 测量实际负载；Pinia-React 的 Immer 和追踪都有成本 |

Context 传递值，本身不提供选择性外部 Store 订阅。Redux middleware、Zustand middleware 和 Pinia 插件不能互换。更集中的对比见 [Pinia-React 与 Zustand](./compare-zustand)。

## 一次迁移一个功能

1. 选一个业务持有者，保持 UI 合同。不要顺带改局部输入和服务端缓存归属。
2. 通过一个明确边界转移已校验快照。Pinia State 只读，setter 或 reducer case 改为 Action，重复派生值可改为 Getter。
3. 显式迁移副作用，重建订阅、失败重试和插件接入，不要让新旧 Store 双向写入。Action 失败不回滚先前修改。
4. SSR 传请求快照，不用全局 Store。组件外服务保留并显式传入 Pinia，`await` 前后都一样；普通访问函数不读取 Context。
5. 等输入、异常、持久化和 hydration 测试通过，再移除旧功能订阅。

成本包括调用处和测试修改、快照校验，以及实例归属审查。[结算示例](./checkout-report)使用四个 Pinia Store 和一个 Zustand creator，这只是示例约定，不能证明维护成本更低。

## 范围

Provider、同步持久化和可选 Redux DevTools 仍在对应页面。Setup Store、selector API、Store 热更新、异步持久化、跨标签页同步、自动 schema 迁移和独立诊断 UI 不在支持范围。实际运行边界见[实例生命周期](../core-concepts/outside-component-usage)和 [Action 迁移](./migration)。
