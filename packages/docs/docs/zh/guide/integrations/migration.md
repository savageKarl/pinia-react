# Action 运行时迁移

解构式 defineStore API、命名 Hook 与 getStore、createPinia() 和原有函数 patch 继续可用。新应用可以采用 PiniaProvider，普通 React 应用也可以保留原有 activePinia 初始化。

| 行为 | 原运行时 | 当前运行时 |
| --- | --- | --- |
| 多次同步赋值 | 通常由一个 Action Draft 提交 | 每次真实赋值分别提交 |
| await 前后修改 | Draft 生命周期不同 | 稳定的修改代理，读取最新状态 |
| 嵌套 Action | 外层 Draft 可能覆盖内层修改 | 每个 Action 独立提交 |
| Action 失败 | 同步 Draft 修改可能回滚 | 保留已经提交的修改 |
| 数组可变方法 | 可能受到 Draft 生命周期影响 | 每次方法调用作为一次逻辑提交 |
| 订阅回调 | 两个状态参数 | 增加可选的第三个 MutationEvent 参数 |

需要同步原子更新时使用 $patch(fn)，浅层批量替换顶层字段时使用 $patch(object)。patch 回调抛错不会提交其草稿修改。Action 本身没有隐式事务或异步回滚，请在 finally 中恢复标志，或显式实现业务恢复。

插件和 DevTools 会接收每次真实提交。可以通过可选的 actionId 和 parentActionId 关联事件，不要依赖其字符串格式。Action 内的 patch 事件类型仍是 patch。仅 Getter 依赖失效不会触发状态订阅。

正式支持的响应式状态模型为 JSON 对象、数组和基本值。Date、Map、Set 应转换为 JSON 数据，不要依赖透明修改语义。快照、根 Provider 生命周期和客户端 getStore 的边界见 [Next.js App Router](./nextjs)。
