import { defineStore, expectType } from '.'

const { getStore } = defineStore('name', {
  state: () => ({ a: 'on' as 'on' | 'off', nested: { counter: 0 } }),
  getters: {
    upper: (state) => {
      expectType<'on' | 'off'>(state.a)
      return state.a.toUpperCase() as 'ON' | 'OFF'
    },
    doubleCounter: (state) => {
      return state.nested.counter * 2
    }
  },
  actions: {
    toggle() {
      this.a = this.a === 'on' ? 'off' : 'on'
    }
  }
})

const store = getStore()

expectType<'on' | 'off'>(store.a)
expectType<number>(store.nested.counter)
expectType<'ON' | 'OFF'>(store.upper)
expectType<number>(store.doubleCounter)
expectType<() => void>(store.toggle)

// @ts-expect-error
store.nonExistent

// @ts-expect-error
store.upper = 'thing'

const { getStore: getEmptyStore } = defineStore('empty', {})
const emptyStore = getEmptyStore()

// @ts-expect-error
emptyStore.nonExistent
