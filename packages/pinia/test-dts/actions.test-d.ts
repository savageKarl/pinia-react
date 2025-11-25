import { defineStore, expectType } from '.'

const { useStore, getStore } = defineStore('name', {
  state: () => ({ count: 0 }),
  actions: {
    increment() {
      this.count++
    }
  }
})

const store = getStore()
expectType<number>(store.count)
expectType<() => void>(store.increment)
