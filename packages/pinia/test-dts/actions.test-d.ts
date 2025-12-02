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

const store = getStore()
expectType<number>(store.count)
expectType<() => void>(store.increment)
expectType<(amount: number) => void>(store.add)

// @ts-expect-error
store.add('5')

type StoreFromGetStore = ReturnType<typeof getStore>
type StoreFromUseStore = ReturnType<typeof useStore>

expectType<TypeEqual<StoreFromGetStore, StoreFromUseStore>>(true)
