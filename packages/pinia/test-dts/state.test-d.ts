import type { Draft } from 'immer'
import { defineStore, expectType, type TypeEqual } from '.'

const { useStore, getStore } = defineStore('main', {
  state: () => ({
    count: 0,
    name: 'Eduardo',
    items: [] as { id: number }[]
  }),

  getters: {
    double: (state) => {
      expectType<number>(state.count)
      return state.count * 2
    },
    upperName(): string {
      expectType<number>(this.double) // this 可以访问其他 getter
      return this.name.toUpperCase()
    }
  },

  actions: {
    increment(amount: number = 1) {
      this.count += amount
    },
    // 测试 actions 内部的 $patch
    clear() {
      this.$patch((state) => {
        expectType<Draft<{ count: number; name: string; items: { id: number }[] }>>(state)
        state.count = 0
        state.items = []
      })
    }
  }
})

// 1. 所有测试都基于 `getStore()` 的返回值
const store = getStore()

// 验证 state 类型
expectType<number>(store.count)
expectType<string>(store.name)

// 验证 getters 类型
expectType<number>(store.double)
expectType<string>(store.upperName)

// 验证 actions 类型
expectType<(amount?: number) => void>(store.increment)

// 验证内置 API 类型
// 修正：$patch 只接受函数形式
store.$patch((state) => {
  state.count = 10
  state.name = 'Patak'
})
expectType<number>(store.$state.count)
store.$reset()

// 2. 静态地验证 `useStore` 的返回类型
type StoreFromGetStore = ReturnType<typeof getStore>
type StoreFromUseStore = ReturnType<typeof useStore>
expectType<TypeEqual<StoreFromGetStore, StoreFromUseStore>>(true)
