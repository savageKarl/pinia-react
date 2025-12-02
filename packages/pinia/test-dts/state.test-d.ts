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
      expectType<number>(this.double)
      return this.name.toUpperCase()
    }
  },

  actions: {
    increment(amount: number = 1) {
      this.count += amount
    },
    clear() {
      this.$patch((state) => {
        expectType<Draft<{ count: number; name: string; items: { id: number }[] }>>(state)
        state.count = 0
        state.items = []
      })
    }
  }
})

const store = getStore()

expectType<number>(store.count)
expectType<string>(store.name)

expectType<number>(store.double)
expectType<string>(store.upperName)

expectType<(amount?: number) => void>(store.increment)

store.$patch((state) => {
  state.count = 10
  state.name = 'Patak'
})
expectType<number>(store.$state.count)
store.$reset()

type StoreFromGetStore = ReturnType<typeof getStore>
type StoreFromUseStore = ReturnType<typeof useStore>
expectType<TypeEqual<StoreFromGetStore, StoreFromUseStore>>(true)
