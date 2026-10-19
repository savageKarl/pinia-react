# 结算示例

从仓库根目录运行现有应用：

~~~sh
pnpm playground-react
pnpm playground-nextjs
~~~

打开 React Playground 的 `#checkout` 或 Next.js Playground 的 `/checkout`。两处复用同一业务流程，不是电商后端模板。

## 可以尝试什么

- 数量 4 超出库存，禁止购买。
- 数量 2 并选择配送时，必须填写地址。
- 模拟请求失败后库存仍是 3；重试成功后总额 **$29.00**、库存 **1**、共享购物车数量 **2**。
- 重复提交会在 pending 时被忽略。等待请求期间改变选择会要求重试，不按过期选择预留库存。

Pinia 用库存、偏好、购物车和结算四个 Store 划分职责。Getter 推导总额和可提交条件，Action 负责校验、pending/error 状态和库存修改。独立摘要读取同一个购物车。跨 Store Getter 解析所属实例；异步业务服务保留显式依赖，不依赖全局 active Pinia。

Zustand 对照使用一个独立 vanilla creator、显式派生读取和不可变更新。两边复用同一表单、整数分价格、数量限制和模拟提交请求。四 Store 拆分和单 creator 都不是另一库必须遵循的结构。示例展示业务组织方式，不用于性能排名。

## 集成边界

只有 Pinia 一侧演示现有持久化和 DevTools 插件。SPA 将配送偏好存到 localStorage，Next 使用白名单请求 Cookie 适配器；这里不做等价持久化、SSR 或 middleware 排名。

Cookie 的 `pick` 过滤恢复和保存的字段，不会从 RSC props 中删去原始白名单 Cookie。不要把秘密或地址写进演示 Cookie。生产环境需要服务端库存与订单校验，以及请求幂等。

根 Provider 在导航和 `router.refresh()` 时保留客户端状态，整页刷新会重建未持久化的购物车和库存。Provider 卸载本身不销毁资源。`onStoreDebug` 仅用于开发，追踪见已有 `#diagnostics`，不用于生产遥测。

## 测试

业务测试使用真实 Action，覆盖失败重试、共享状态、实例隔离、持久化字段选择和 SSR 快照。现有浏览器探针覆盖等价 SPA 输入和 Next 请求/hydration 流程：

~~~sh
pnpm test:checkout:browser
~~~

先构建包和两个 Playground，再启动生产服务。脚本默认连接 `http://127.0.0.1:4173` 的 React preview 和 `http://127.0.0.1:4174` 的 Next 服务。测试准备见[真实 Store 测试](../core-concepts/testing)。
