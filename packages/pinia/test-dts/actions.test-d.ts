import { defineStore, expectType, type TypeEqual } from '.'

const { useStore, getStore } = defineStore('counter', {
  state: () => ({
    count: 0
  }),
  actions: {
    increment() {
      this.count++
    },
    add(amount: number) {
      this.count += amount
    }
  }
})

// 1. 使用 `getStore()` 来获取 store 实例并进行详细的类型测试
const store = getStore()
expectType<number>(store.count)
expectType<() => void>(store.increment)
expectType<(amount: number) => void>(store.add)

// @ts-expect-error - action 调用时参数类型不匹配
store.add('5')

// 2. 静态地验证 `useStore` 的返回类型
// 我们不能直接调用 `useStore()`，但可以中断言它的返回类型和 `getStore()` 的返回类型完全相同
type StoreFromGetStore = ReturnType<typeof getStore>
type StoreFromUseStore = ReturnType<typeof useStore>

expectType<TypeEqual<StoreFromGetStore, StoreFromUseStore>>(true)
