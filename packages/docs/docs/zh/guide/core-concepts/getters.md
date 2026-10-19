# Getters

Getter 根据 State 或其他 Getter 计算衍生数据。结果会被缓存，依赖变化后才重新计算。

在 `defineStore()` 的 `getters` 中定义 Getter；第一个参数是当前 Store 的 `state`。

```tsx
export const { useCounterStore, getCounterStore } = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount: (state) => state.count * 2,
  },
})
```

## 访问其他 Getter

如果要在某个 Getter 内部使用其他 Getter，你可以使用普通函数形式，并通过 `this` 访问 Store 的其他属性。在 TypeScript 中，你**必须**显式定义返回类型才能使其正常工作。

```tsx
export const { useCounterStore, getCounterStore } = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount(state) {
      return state.count * 2
    },
    // 此处**必须**显式设置返回类型
    doublePlusOne(): number {
      // 这里的 `this` 拥有自动补全和类型注解 ✨
      return this.doubleCount + 1
    },
  },
})
```

然后，你可以在组件中直接通过 Store 实例访问 Getter：

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function CounterComponent() {
  const counter = useCounterStore();

  return (
    <p>双倍计数值是 {counter.doubleCount}</p>
  );
}
```

## 访问其他 Store 的 Getter

在 Getter 中调用另一个 Store 的 `getOtherStore()`，再读取需要的属性；不要调用 React Hook。通用的 `getStore()` 别名也可使用。

```tsx
import { getOtherStore } from './other-store'

export const { useMainStore, getMainStore } = defineStore('main', {
  state: () => ({
    localData: 'hello'
  }),
  getters: {
    combinedData(state): string {
      const otherStore = getOtherStore()
      return state.localData + ' ' + otherStore.data
    },
  },
})
```


## 跨 Store 依赖

同步求值 Getter 时，`getOtherStore()` 使用当前 Getter 所属 Pinia，而不是全局 active Pinia。在 Getter 内获取另一个 Store，不要捕获模块顶层 Store。显式传入另一实例会抛错，不支持跨实例响应式 Getter 依赖。Getter 保持同步，异步工作放在 Action。

本地 Getter 按读取路径追踪依赖，跨 Store 依赖则是 Store 级别：源 Store 即使只修改了未读取字段，也可能让依赖它的 Getter 失效。失效会沿 `A → B Getter → C Getter` 等链路传播，再通知订阅者。仅 Getter 失效不产生业务 Mutation。循环 Getter 求值会告警，不是受支持的计算方式。

组件依赖来自已提交的渲染。挂起或放弃的渲染不会替换上一次读取集合。父组件、props、Context 和其他 React 工作仍可独立触发渲染。

## 开发期诊断

~~~tsx
import { onStoreDebug } from 'pinia-react'

const stop = onStoreDebug(pinia, event => console.debug('store-debug', event))

function Summary() {
  const cart = useCartStore('Summary')
  return <output>{cart.total}</output>
}

// 诊断结束后停止观察。
stop()
~~~

可选字符串标记一次 Hook 使用，不会自动发现组件名称。重复行使用不同标签。开始观察不会强制渲染或回放历史，组件事件从下一次已提交的带标签渲染开始。无参 Hook 仍受支持。

| 事件 | 含义 |
| --- | --- |
| `mutation` | 真实 Store 提交；一个 Action 可能提交多次 |
| `dependencies` | 已提交的带标签渲染读取的路径和 Getter |
| `notify` | Store 匹配后请求更新，不代表 React 已提交 |

单独使用 React Profiler 查看提交。Store 通知可能被批处理，这些事件不能解释所有 React 渲染。诊断回调异常会隔离，业务订阅异常仍传播；通知中途失败后，诊断不是完整审计。

诊断需要显式启用，生产环境禁用。开发构建需替换 `process.env.NODE_ENV`；没有环境定义或 process 全局时，诊断保持关闭。事件不含状态快照、patch 值和 Action 参数，但名称、路径键、标签和来源仍可能敏感，请只用于可信的本地控制台。

运行 `pnpm playground-react`，打开 `#diagnostics`。现有示例对照未读字段、动态路径、跨 Store Getter 和父组件 props 更新。启用控制台 Debug/Verbose 输出，可分别查看 `store-debug` 和 `react-commit`，不需要配置额外面板。
