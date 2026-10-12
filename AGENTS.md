# Agent 开发指南

本文规定 Agent 在本仓库中的工作方式。它是开发操作规约，不替代用户文档、API 文档或完整的贡献指南。

## 适用范围与规则优先级

- 本规则适用于整个仓库。
- 用户当前的明确要求优先于本文档。
- 分支、提交、Pull Request、Changesets 和发布流程以 `CONTRIBUTING.md` 为准。
- 如果未来在子目录中增加更具体的 `AGENTS.md`，则该文件的规则适用于对应子目录。
- 对于只要求分析的任务，不得修改文件。只有用户要求实现、修复、编写文档或其他写入操作时，才能编辑仓库。

## 标准开发流程

执行实现类任务时，按以下顺序进行：

1. 编辑前检查当前分支和工作区状态。不得在 `main` 分支上开发、修改或提交；如果当前处于 `main`，先创建或切换到任务分支，再开始编辑。保留用户已有改动，不得重置或覆盖。
2. 在确定方案前，阅读相关源码、测试、package manifest 和现有文档。
3. 判断受影响的 package、公共 API、运行时行为和发布影响。
4. 查找覆盖目标行为的现有测试。如果行为缺失或当前存在缺陷，先增加针对性的回归测试。
5. 进行最小且完整的实现修改。避免无关重构、格式化噪音，以及没有明确必要性的抽象。
6. 根据需要更新类型测试、用户文档、双语文档和 Changeset。
7. 先运行最小范围的相关检查；对于跨 package 或公共 API 变更，再运行完整检查。
8. 检查最终 diff 和工作区状态，确认没有生成文件、无关改动、遗漏测试或遗漏发布文档。
9. 汇报实际修改内容、实际执行的检查，以及剩余的环境或测试限制。未执行的检查不得报告为通过。

## 仓库目录边界

| 路径 | 边界与要求 |
| --- | --- |
| `packages/pinia/src` | 可发布的核心运行时和公共类型。修改时必须重点检查运行时行为、类型和兼容性。 |
| `packages/pinia/tests` | 核心 package 的运行时行为和回归测试。 |
| `packages/pinia/test-dts` | 公共 TypeScript API 的编译期测试。 |
| `packages/devtools/src` | `pinia-react` 的 Redux DevTools 适配层，不得演变成第二套状态管理层。 |
| `packages/devtools/tests` 和 `packages/devtools/test-dts` | DevTools package 的运行时和公共类型测试。 |
| `packages/docs` | 私有 Rspress 文档站点。存在对应页面时，英文和中文内容必须保持同步。 |
| `packages/playground` | 私有手动验证应用。不得将仅适用于 playground 的临时 workaround 移入可发布 package，除非它代表库级需求并有对应测试。 |
| `.github` | CI、发布和文档部署工作流。只有任务涉及工作流行为时才修改。 |
| `dist`、`coverage`、`.next` 及其他被忽略的输出目录 | 生成物。禁止直接编辑或提交。 |

除非依赖关系或用户可见行为确实要求，否则不要把一个 package 的改动扩展到其他 package。修改根目录配置必须有明确的 workspace 级理由。

## 变更决策矩阵

使用以下矩阵判断一次变更必须包含哪些后续工作：

| 变更类型 | 必须完成的后续工作 |
| --- | --- |
| `packages/pinia/src` 中的核心运行时行为 | 增加或更新针对性的运行时测试，并检查受影响的类型行为和构建结果。 |
| 公共 API、导出类型或声明行为 | 在适用时增加运行时测试，更新 `test-dts`，检查用户文档，并评估是否需要 Changeset。 |
| getter 依赖、跨 store 访问、订阅、patch、reset、restore 或异步 action 行为 | 针对受影响的生命周期和边界场景增加回归测试。 |
| DevTools 消息处理或状态恢复 | 测试 Redux DevTools 协议、mutation origin 过滤，以及适用的浏览器/SSR 边界。 |
| 用户可见文档 | 对应的英文和中文页面存在时，必须同步更新；需要时同步更新导航元数据。 |
| `tests/**`、`test-dts/**`、文档、playground 或仅 CI 变更 | 通常不需要 Changeset，但必须运行与修改范围相关的检查。 |
| 可发布 package 中的 `src/**`、`package.json` 或 `tsup.config.ts` | 遵循 `CONTRIBUTING.md` 中的 Changeset 规则，禁止手动修改版本号。 |

不得通过删除测试、放宽类型检查、在没有文档说明的情况下改变预期公共行为，或使用宽泛的类型断言来让测试通过。

## 核心运行时约束

以下是必须保持的行为契约，不是可随意调整的实现偏好：

- `createPinia()` 创建 Pinia 实例并将其设为 active。不同 Pinia 实例之间的 store 实例和内部 scope 必须相互隔离。
- `defineStore()` 同时提供面向 React 组件的 `useStore` 和面向非 hook 场景的 `getStore`。生成的命名别名必须保持类型安全。
- 公共 store 状态是只读的。状态修改必须经过 action、`$patch`、`$reset` 或仅供插件使用的 `restoreState`。
- 一次已提交的 mutation 必须保持 store scope、`pinia.state`、Immer patches、listeners、getter 缓存和 `MutationEvent` 元数据的一致性。
- `useStore` 依赖 `useSyncExternalStore` 和路径级依赖追踪。不得引入无关的组件重新渲染，也不得破坏 snapshot/subscription 契约。
- getter 结果会被缓存，并根据追踪到的依赖进行失效。跨 store getter 依赖和循环依赖警告必须继续生效。
- action 在 `await` 之后的状态修改仍必须经过同一套 mutation 生命周期；不得绕过 patch 派发或订阅通知。
- plugin 在 store 创建时应用。不得静默改变“store 已创建后才注册 plugin”的现有行为。
- DevTools 状态恢复必须保留 mutation origin，避免集成层把自己发起的 restore 事件再次发送回 Redux DevTools。
- 核心使用隔离的 Immer 实例。不得因为使用核心库而修改宿主应用的全局 Immer 配置。

修改 `packages/pinia/src/store.ts` 前，先阅读周边运行时测试，再决定是否调整状态机。优先采用范围明确的修复，避免大范围重写。

## 验证规则

项目支持的本地工具链是 Node.js 22 和 pnpm 10。命令应从仓库根目录执行。

### 定向检查

```bash
pnpm --filter pinia-react test -- --run
pnpm --filter pinia-react test-dts
pnpm --filter @pinia-react/devtools test -- --run
pnpm --filter @pinia-react/devtools test-dts
pnpm run docs-build
```

### 完整检查

```bash
pnpm run check
pnpm run test
pnpm run test-dts
pnpm run build
```

孤立的小范围改动使用定向检查。出现以下情况时运行完整检查：跨 package 变更、共享配置变更、公共 API 变更，或构建/发布行为变更。

如果命令因为依赖安装、权限、网络或其他环境问题失败，必须将环境失败与代码失败区分开。不得静默跳过命令；要报告具体限制，并继续运行仍然可以执行的独立检查。

## Git 与安全边界

- `main` 只用于同步和发布基线，不用于日常开发。任何代码、测试、文档或配置修改都必须在任务分支上进行，任何提交也必须发生在任务分支上。
- 任务分支默认使用 `codex/` 前缀，并使用能表达任务目的的短名称，例如 `codex/update-agents-guide`。
- 如果发现当前在 `main`，先确认工作区状态，再创建或切换到任务分支；不得为了切换分支而丢弃或覆盖已有改动。
- 除非用户明确要求，不得使用 `git reset --hard`、`git checkout --` 等破坏性命令。
- 不得回滚、重新格式化或删除用户已有的无关改动。
- 不得通过编辑生成物或依赖缓存来掩盖源代码问题。
- 除非用户明确要求，不得创建 commit、Pull Request、release，也不得发布 package。为遵守本文件的分支规则，可以创建任务分支，但不得擅自创建无关分支。
- 不得手动修改 package 版本号或生成的 changelog。
- 不得把当前任务扩大成未要求的清理或重构。

## 完成标准

一个实现类任务只有在满足以下条件时才算完成：

- 改动范围限定在用户要求的行为和受影响边界内。
- 用户已有改动得到保留。
- 必要的运行时测试和类型测试已经添加，或者已经明确说明为什么不需要添加。
- 已评估文档和 Changeset 要求。
- 相关检查确实已经执行，并准确报告失败和限制。
- 最终 diff 中没有无关文件或生成物。
- 最终报告说明修改内容、验证内容和仍未解决的问题。

贡献流程、提交约定、Pull Request、文档政策和发布细节，请在创建或更新贡献前阅读 `CONTRIBUTING.md`。
