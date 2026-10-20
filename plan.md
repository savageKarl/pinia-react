# Pinia-React 审计问题修复计划

> 计划日期：2026-10-20
> 来源：只读代码审计与最小运行时复现
> 当前状态：实现、常规验证和旧实现红灯验证完成；改动未提交

## 当前进度（2026-10-20）

- 五项问题均已完成运行时代码修改、当前实现回归测试、双语文档评估和 Changeset。
- 已在 HEAD 基线快照中运行新增 focused tests：核心 5 项失败，DevTools 4 项失败。
- 已修正 Getter 菱形测试的断言位置，确认它现在在基线实现上真实失败。
- 已在当前修复后的工作树中重跑同一 focused tests：核心 49 项通过，DevTools 19 项通过。
- `pnpm run check`、`pnpm run test`、`pnpm run test-dts`、`pnpm run build`、`pnpm run docs-build`、`pnpm run test:compat` 均已通过。
- `pnpm exec changeset status` 确认 `pinia-react` 与 `@pinia-react/devtools` 都是 patch。
- 浏览器自动化检查是可选项，尚未运行；当前分支改动尚未提交。

## 1. 背景与目标

本计划针对审计中确认的 5 个问题，目标是修复真实的用户可见错误，同时保持现有 Store 生命周期、Immer Mutation、React `useSyncExternalStore` 订阅模型、插件清理语义和 SSR 边界不变。

审计基线：

- `pnpm run check` 已通过。
- `pnpm run test` 已通过。
- `pnpm run test-dts` 已通过。
- `pnpm run build` 已通过。
- `pnpm run docs-build` 已通过。
- `pnpm run test:compat` 已通过。
- 当前审计只读复现确认了对象结构追踪、DevTools 异常、`__proto__` Store ID 和 Action `defineProperty` 行为。

### 1.1 目标

1. 动态对象字段新增、删除和存在性判断能够触发正确的 React 更新和 Getter 失效。
2. Redux DevTools 作为可选调试集成，不得让已经提交的业务 Mutation 向调用方表现为失败。
3. 特殊 Store ID 不得破坏 `pinia.state` 的枚举、序列化和释放行为。
4. Action 中不支持的反射写入不得静默丢失。
5. 正常的 Getter 菱形依赖不得被误报为循环依赖。
6. 每个问题都有一个能在未来失败时阻止回归的 focused regression test。

### 1.2 非目标

- 不重写 Store 状态机。
- 不增加新的状态管理抽象或第三方依赖。
- 不改变现有异步 Action 的上下文语义；当前设计仍不提供跨 `await` 的自动异步上下文传播。
- 不把不透明特殊值（`Date`、`Map`、`Set`、类实例等）变成透明响应式对象。
- 不扩展持久化插件的异步存储、跨标签同步或自动迁移能力。
- 不修改生成的 `dist`、coverage 或依赖缓存。

## 2. 影响范围

### 2.1 预计修改文件

核心运行时：

- `packages/pinia/src/store.ts`
- `packages/pinia/src/mutationProxy.ts`
- `packages/pinia/src/createPinia.ts`（如果采用内部安全容器方案）
- `packages/pinia/src/lifecycle.ts`（如果释放逻辑需要配合安全容器）

DevTools：

- `packages/devtools/src/devtools.ts`

回归测试：

- `packages/pinia/tests/react-tracking.spec.tsx`
- `packages/pinia/tests/store.getters.spec.ts`
- `packages/pinia/tests/store.actions.runtime.spec.ts`
- `packages/pinia/tests/store.edge-cases.spec.ts`
- `packages/pinia/tests/circular-dependencies.spec.ts`
- `packages/devtools/tests/devtools.spec.tsx`
- 必要时新增单独的 `packages/devtools/tests/errors.spec.ts`

文档与发布：

- 如果 `defineProperty` 的行为变成公开的明确错误，需要更新核心 State/Action 文档的边界说明。
- 如果 Store ID 被限制或内部容器行为改变，需要更新对应的核心 API 文档。
- 核心包修改需要新增 `pinia-react` Changeset。
- DevTools 包修改需要新增 `@pinia-react/devtools` Changeset。
- 若最终只修改测试或文档，则不新增 Changeset；若修改 `src/**`，必须重新评估并补 Changeset。

### 2.2 需要保持的调用方行为

- 已有普通字符串字段、嵌套字段、数组索引、数组长度和数组迭代行为保持不变。
- `$patch`、`$reset`、插件 `restoreState` 和异步 Action 写入仍走同一 Mutation 生命周期。
- Getter-only 跨 Store 失效仍不产生新的业务 Mutation。
- DevTools 的跳转、回滚、重置、导入状态仍然不会把恢复 Mutation 回传给扩展。
- 插件清理、Store 替换、Pinia dispose 和失败初始化回滚不受影响。

## 3. 实施顺序

按以下顺序执行，先补能复现问题的测试，再做最小实现：

1. 为 5 个问题补充失败测试，确认测试确实能捕获当前行为。
2. 修复对象结构依赖追踪，因为它影响 React 渲染和 Getter 缓存，是核心运行时优先级最高的问题。
3. 修复 DevTools 异常隔离，避免可选集成中断已提交业务。
4. 修复特殊 Store ID 的内部容器写入和释放。
5. 明确并修复 Action `defineProperty` 的边界。
6. 修复 Getter 依赖递归的误报。
7. 运行 focused checks，再运行完整检查、构建和文档检查。
8. 最后复查 diff、Changeset、双语文档和工作树。

## 4. 问题一：对象结构追踪缺失

### 4.1 当前行为

相关实现位于 `packages/pinia/src/store.ts` 的 `createStateProxy`。

当前普通渲染读取叶子字段时会记录路径，例如：

```text
store.user.name -> ["user", "name"]
```

数组长度和迭代有专门处理，但嵌套普通对象的 `ownKeys` 和 `has` trap 只调用 `Reflect`，没有向 `onDeepAccess` 报告依赖。

因此以下代码不会可靠地建立 `fields` 的结构依赖：

```tsx
Object.keys(store.fields)
```

之后执行：

```ts
this.fields.newField = value
```

Patch 路径是 `['fields', 'newField']`，但已提交渲染没有记录 `['fields']` 或对应字段路径，React 订阅过滤器不会请求更新。

同一问题也影响 Getter：

```ts
getters: {
  fieldCount: (state) => Object.keys(state.fields).length
}
```

### 4.2 实现方案

优先采用最小方案：

1. 在嵌套状态 Proxy 的 `ownKeys` trap 中记录当前对象路径。
2. 在 `has` trap 中记录适合的存在性依赖，覆盖 `key in object` 和 `Object.hasOwn(object, key)`。
3. 保持叶子字段追踪逻辑不变，避免把所有普通字段读取退化成整棵 Store 更新。
4. Getter 使用的 `trackObjectAccess` 路径也必须通过同一机制生效。
5. 不在 `Object.keys(store.$state)` 上重复记录额外路径；`$state` 仍保持现有的全状态依赖语义。

实现时需要确认：

- 根对象路径为空数组时的处理不会让普通 Store 根代理意外订阅所有状态。
- 数组 `ownKeys`、`length`、`Symbol.iterator` 不会重复产生无界依赖。
- 删除字段、替换整个对象和新增字段都能命中同一个结构依赖。
- 只读代理和 Action mutation proxy 的反射行为不被混淆。

### 4.3 回归测试

在 `packages/pinia/tests/react-tracking.spec.tsx` 增加：

1. `Object.keys(store.fields)` 在新增字段后重新渲染。
2. 删除字段后 `Object.keys` 结果更新。
3. `for...in store.fields` 在新增字段后更新。
4. `Object.hasOwn(store.fields, 'newField')` 在字段新增后更新。
5. 只读取对象键集合时，修改无关 Store 字段不会造成不必要更新。

在 `packages/pinia/tests/store.getters.spec.ts` 增加：

1. `Object.keys(state.fields).length` 在新增、删除字段后重新计算。
2. Getter 结果缓存仍然只在相关对象结构变化时失效。

### 4.4 验收标准

- 动态新增和删除字段都会更新 React DOM。
- Getter 不会返回旧的字段数量。
- 现有数组、叶子路径、跨 Store Getter 和并发渲染测试全部通过。
- 不相关字段更新仍然不会触发只依赖另一个对象的组件。

## 5. 问题二：DevTools 异常中断业务 Mutation

### 5.1 当前行为

`packages/devtools/src/devtools.ts` 的 Mutation listener 直接调用：

```ts
connection.send(actionFor(event), event.state)
```

核心 Mutation 已经更新状态后，DevTools 连接才发送消息。如果扩展端口被关闭或扩展实现抛错，异常会从插件 listener 冒泡回核心 dispatch。

结果是：

- Store 状态已经变更。
- `$patch()` 或 Action 的调用方收到异常。
- 后续 Mutation listener 可能没有机会执行。

这会让调用方误以为业务没有提交成功。

### 5.2 实现方案

1. 对 `connection.send()` 做异常隔离。
2. 对初始 `connection.init()` 做同样的边界处理，避免可选 DevTools 阻止 Store 创建。
3. 发生连接异常后，将当前连接标记为 inactive，避免每次 Mutation 重复抛错。
4. 继续执行核心 Mutation 的其他 listener 和清理逻辑。
5. 不调用扩展级别的全局 `disconnect`，不影响其他 Pinia 实例或其他 Store 的连接。
6. 保留现有恢复消息的来源过滤和生命周期清理。

异常处理策略需要明确：

- 默认不把扩展异常重新抛给业务调用方。
- 开发环境可以使用一次性 `console.warn`，但不能打印敏感 State payload。
- 清理时仍必须调用当前连接的 unsubscribe。

### 5.3 回归测试

在 `packages/devtools/tests/devtools.spec.tsx` 或新增错误测试文件中增加：

1. `connection.send` 抛错时，Store 状态仍提交成功，`$patch()` 不抛错。
2. `connection.send` 抛错后，后注册的 `pinia.onMutation` listener 仍会执行。
3. 连接失败后不会对每个后续 Mutation 重复调用失效的 `send`。
4. `connection.init` 抛错时，Store 初始化行为符合选定策略，且已注册资源被清理。
5. dispose 后仍不会向已失效连接发送消息。

### 5.4 验收标准

- DevTools 连接故障不会改变业务 Action 的成功/失败结果。
- 已提交 State、Persistence listener 和其他插件 listener 保持一致。
- 现有跳转、回滚、导入和 cleanup 测试全部通过。
- 多 Pinia 实例之间互不影响。

## 6. 问题三：特殊 Store ID 破坏状态容器

### 6.1 当前行为

`pinia.state` 和 `_initialStores` 使用普通对象保存 Store ID 到状态的映射。

当 Store ID 为 `__proto__` 时：

```ts
pinia.state[id] = initialState
```

会触发普通对象的特殊 `__proto__` setter，而不是创建一个普通自身属性。

可观察结果：

- `Object.keys(pinia.state)` 不包含该 Store。
- `JSON.stringify(pinia.state)` 丢失该 Store。
- 释放逻辑基于 `Object.keys` 时无法正常删除该条目。
- `pinia.state` 的原型被替换为 Store 状态对象。

### 6.2 实现方案

优先方案：让内部状态映射使用无原型对象。

需要评估并处理：

1. `createPiniaInstance()` 中的 `state` 使用 `Object.create(null)`。
2. `_initialStores` 也使用安全容器，避免初始化快照处理出现同类问题。
3. 所有依赖 `Object.keys`、`Object.hasOwn`、删除字段和 JSON 序列化的逻辑保持语义一致。
4. 确认公共 `pinia.state` 的类型和用户读取方式不受影响。
5. 如果无原型容器会破坏已公开的原型语义，则改用 `Object.defineProperty` 写入每个 Store ID，并在释放时显式删除。

不建议只静默禁止 `__proto__`，除非确认这是最小且兼容性最好的 API 策略；如果选择拒绝，必须提供清晰错误和文档说明。

### 6.3 回归测试

在 `packages/pinia/tests/store.edge-cases.spec.ts` 增加：

1. `defineStore('__proto__', ...)` 后，`Object.keys(pinia.state)` 包含该 ID。
2. `JSON.stringify(pinia.state)` 包含该 Store。
3. Store 状态仍可通过 `getStore(pinia)` 正常读取和更新。
4. `disposePinia(pinia)` 后，状态容器没有残留的 Store 原型或状态字段。
5. `constructor`、`prototype` 等相邻特殊 ID 也能正常工作。

### 6.4 验收标准

- 特殊 ID 不会改变状态容器原型。
- SSR 快照、调试工具和用户直接遍历 `pinia.state` 都能看到 Store。
- Store dispose 和失败初始化回滚仍然通过。

## 7. 问题四：Action `Object.defineProperty` 静默丢失写入

### 7.1 当前行为

Action 中的 `this` 使用 `createMutationProxy`。普通赋值和删除会调用 `commit()`，但 `defineProperty` trap 当前只对临时 Proxy target 执行 `Reflect.defineProperty`。

示例：

```ts
actions: {
  update() {
    Object.defineProperty(this, 'count', {
      value: 3,
      writable: true,
      enumerable: true,
      configurable: true
    })
  }
}
```

当前结果是状态仍为旧值、没有 Patch、没有 Mutation 通知，也没有错误提示。

### 7.2 实现方案

优先采用最小且不会伪造 descriptor 语义的方案：

1. 对 Action 状态代理上的字符串 `defineProperty` 明确抛出不支持错误，避免静默丢失。
2. 对符号键继续使用现有的状态键校验。
3. 不把任意 descriptor 的 writable、enumerable、configurable 语义强行转换成普通赋值。
4. 如果产品确实需要支持 descriptor，再单独设计完整的 draft descriptor 语义，不在本次小修复中扩展。
5. 对 `$patch` 的 function draft 保持现有行为；该路径已经直接操作 Immer draft，不应被 Action proxy 的修复误伤。

### 7.3 回归测试

在 `packages/pinia/tests/store.actions.runtime.spec.ts` 增加：

1. Action 中对普通字符串字段调用 `Object.defineProperty`，验证得到明确错误。
2. 确认状态、Patch、Mutation listener 都没有半提交结果。
3. 确认已有普通赋值、删除、`Object.assign` 和数组操作仍正常。
4. 保留现有符号键 `defineProperty` 测试，确认错误信息和行为一致。

### 7.4 验收标准

- 不再存在“调用成功但状态没有变化”的静默失败。
- 错误发生在提交前，不产生部分 Mutation。
- 现有 Action、Patch 和反射测试全部通过。

## 8. 问题五：Getter 菱形依赖误报循环

### 8.1 当前行为

`resolveGetterDependencies()` 使用 `visited` 集合检测递归循环，但当前集合在递归返回时不会移除节点。

对于正常的共享依赖：

```text
sum -> left  -> base
sum -> right -> base
```

第二条分支访问 `base` 时会看到它已经在 `visited` 中，于是错误输出循环依赖警告。计算结果通常仍然正确，但诊断信息错误。

### 8.2 实现方案

1. 将 `visited` 明确作为当前递归栈，而不是全局访问集合。
2. 进入 Getter 时加入，完成该 Getter 的所有依赖解析后删除。
3. 只有当前递归路径再次遇到相同 Getter 时才输出循环警告。
4. 保持真正循环的保护，不能恢复无限递归。
5. 不改变跨 Store Getter 的 subscribers 图和缓存失效算法。

### 8.3 回归测试

在 `packages/pinia/tests/circular-dependencies.spec.ts` 增加：

1. 同一 Store 的局部 Getter 菱形依赖不输出循环警告。
2. 菱形依赖在源状态变化后仍然正确失效和重新计算。
3. 真正的自引用和跨 Getter 循环仍然输出警告并终止递归。

### 8.4 验收标准

- 正常共享依赖没有误报。
- 真实循环仍能被检测。
- Getter 缓存、跨 Store 失效和现有多跳测试不回归。

## 9. 验证计划

### 9.1 实施过程中的 focused checks

核心追踪和 Getter：

```bash
pnpm --filter pinia-react test -- --run packages/pinia/tests/react-tracking.spec.tsx packages/pinia/tests/store.getters.spec.ts packages/pinia/tests/circular-dependencies.spec.ts
```

核心 Action 和 Store ID：

```bash
pnpm --filter pinia-react test -- --run packages/pinia/tests/store.actions.runtime.spec.ts packages/pinia/tests/store.edge-cases.spec.ts
```

DevTools：

```bash
pnpm --filter @pinia-react/devtools test -- --run
pnpm --filter @pinia-react/devtools test-dts
```

### 9.2 完整 checks

```bash
pnpm run check
pnpm run test
pnpm run test-dts
pnpm run build
pnpm run docs-build
pnpm run test:compat
```

如果需要真实浏览器验证，再运行：

```bash
pnpm run test:browser
pnpm run test:checkout:browser
```

这些脚本需要对应的本地服务和 Chromium 环境，不能把服务未启动造成的连接失败误判为代码失败。

### 9.3 最终审查清单

- [x] 已证明每个新增回归测试在旧实现上失败、在修复后通过。
- [x] 没有修改 `dist`、coverage、`.next` 或依赖缓存。
- [x] 没有改变未涉及的持久化、SSR Cookie 或 Provider 生命周期行为。
- [x] 核心源代码修改附带 `pinia-react` Changeset。
- [x] DevTools 源代码修改附带 `@pinia-react/devtools` Changeset。
- [x] 用户可见行为变化同步更新英文和中文文档。
- [x] `git diff` 只包含本计划涉及的文件。
- [x] 最终工作树没有未解释的生成文件或用户改动。

## 10. 风险与回滚

### 10.1 主要风险

- 结构依赖追踪过宽会让动态对象组件多渲染；需要测试“相关更新触发、无关更新不触发”。
- DevTools 异常策略改变后，部分用户可能依赖异常冒泡来发现扩展故障；应保留开发环境的一次性警告。
- 修改状态容器原型可能影响直接调用 `Object.prototype` 方法的代码；应优先验证公共 `pinia.state` 读取习惯。
- 明确拒绝 Action `defineProperty` 可能暴露此前未被发现的调用方依赖；这是对现有静默失败的显式化，需要在文档中说明。
- Getter 递归修复不能削弱真实循环检测，必须同时保留真实循环测试。

### 10.2 回滚边界

每个问题应保持独立提交或至少保持独立 diff 区块：

1. 先回滚结构追踪不会回滚 DevTools 异常策略。
2. Store ID 容器修复不得和 Getter 递归逻辑混在一起。
3. 如果 `defineProperty` 行为需要重新讨论，可以单独回滚该边界变更而不影响其他修复。

## 11. 预期交付物

实现完成后应包含：

1. 核心和 DevTools 的最小源代码修改。
2. 5 组 focused regression tests。
3. 必要的英文/中文文档边界说明。
4. 对应 Changeset。
5. 完整检查结果和未执行检查的具体原因。
