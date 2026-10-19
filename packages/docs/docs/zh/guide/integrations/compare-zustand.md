# Pinia-React 与 Zustand

Pinia-React 用 State、Getter 和 Action 组织共享业务状态，追踪组件实际读取的路径。Zustand 使用 state creator 和显式 selector。两者是不同的编写模型，不是兼容 API。

| 需求 | Pinia-React | Zustand |
| --- | --- | --- |
| 小型共享值 | Store 结构可能超出需要 | 通常很直接 |
| 业务边界 | 具名 State、缓存 Getter 和 Action | 应用约定与可选 slices |
| 组件依赖 | 自动读取路径追踪 | 显式 selector |
| 不可变修改 | Action 和函数 patch 内置 Immer | 不可变更新，可选 Immer middleware |
| SSR | 请求快照和有作用域的 Provider | 请求级 Store 和 React 绑定 |

组件局部状态留在组件。业务结构有帮助时选择 Pinia-React；需要小型灵活原语和显式订阅时，Zustand 更合适。两者都不能替代服务端校验，也不保证应用整体性能更好。

## 运行示例

从仓库根目录执行：

~~~sh
pnpm install
pnpm playground-react
~~~

打开 `#comparison`，两边执行相同的计数、资料、购物车和异步更新。渲染计数让订阅行为可见，Strict Mode 和其他 React 工作会影响计数，不能当作速度评分。

打开 `#checkout`，查看使用同一表单、请求桩和恢复规则的[业务闭环](./checkout-report)。Pinia 使用四个业务 Store，Zustand 使用一个 vanilla creator；这是合理的小型 Zustand 实现，不要求照搬 Pinia 结构。可选持久化、DevTools 和 Next.js 接入只作演示，不是等价 middleware 对比。

迁移建议见[选择状态模型](./choosing)。

Zustand API 和 SSR 模型以其官方 [React Store API](https://zustand.docs.pmnd.rs/reference/apis/create)、[vanilla Store API](https://zustand.docs.pmnd.rs/reference/apis/create-store) 和 [Next.js 指南](https://zustand.docs.pmnd.rs/learn/guides/nextjs)为准。
