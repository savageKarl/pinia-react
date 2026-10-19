# 测试真实 Store

沿用现有测试框架。每个测试创建独立 Pinia，显式传给访问函数，直接验证真实 Action 和 Getter：

~~~ts
import { createPinia, defineStore, disposePinia } from 'pinia-react'
import { expect, test } from 'vitest'

const { getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: { double: state => state.count * 2 },
  actions: { add(amount: number) { this.count += amount } },
})

test('更新派生计数', () => {
  const pinia = createPinia()
  try {
    const counter = getCounterStore(pinia)
    counter.$patch({ count: 2 })
    counter.add(3)
    expect(counter.count).toBe(5)
    expect(counter.double).toBe(10)
    counter.$reset()
    expect(counter.count).toBe(0)
  } finally {
    disposePinia(pinia)
  }
})
~~~

第一次获取 Store 前注册测试插件。通过 Action 或 `$patch` 准备状态，公开 State 只读。`$reset` 恢复工厂默认值，不恢复服务端快照或测试中的 patch。

## 组件测试

用 `<PiniaProvider pinia={pinia}>` 包裹组件，与测试中显式访问函数使用同一个本地实例。不要同时传 Provider 的 `plugins` 或 `initialStores`，应在渲染前初始化现有实例。使用 React Testing Library 时，先卸载组件树，再调用 `disposePinia(pinia)`，并确保断言失败时也执行清理。

更新时使用测试框架的 `act` 或 user-event 工具，等待 UI 结果。渲染计数不是性能断言：Strict Mode、父组件和 props 都可能在没有 Store 通知时触发渲染。

## 异步与依赖

等待 Action 完成，分别断言成功和拒绝后的状态。Action 失败前已提交的修改仍会保留，应测试显式恢复，不要假定自动回滚。多个实例并存时，`await` 后仍显式传入实例。

需要确定性的失败场景时，在业务服务中注入网络或时钟依赖，由测试框架 mock。不要直接写只读 State 来制造结果。清理前结束或取消待完成工作，注销手动订阅，确认实例不再使用后再销毁。销毁不会取消任意 Promise。

现有[结算示例](../integrations/checkout-report)包含多 Store 业务测试和等价 UI 输入。[实例生命周期](./outside-component-usage)和[插件清理](../plugins/index)说明相关边界。
