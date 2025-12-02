import { defineStore, expectType, type TypeEqual } from '.'

const { getStore, useStore } = defineStore('main', {
  state: () => ({
    status: 'on' as 'on' | 'off',
    nested: { counter: 0 }
  }),
  getters: {
    upperStatus: (state) => {
      expectType<'on' | 'off'>(state.status)
      return state.status.toUpperCase() as 'ON' | 'OFF'
    }
  },
  actions: {
    toggle() {
      this.status = this.status === 'on' ? 'off' : 'on'
    }
  }
})

const store = getStore()

expectType<'on' | 'off'>(store.status)
expectType<number>(store.nested.counter)

expectType<'ON' | 'OFF'>(store.upperStatus)

expectType<() => void>(store.toggle)

// @ts-expect-error
store.nonExistent

// @ts-expect-error
store.upperStatus = 'thing'

store.status = 'off'

type StoreFromGetStore = ReturnType<typeof getStore>
type StoreFromUseStore = ReturnType<typeof useStore>
expectType<TypeEqual<StoreFromGetStore, StoreFromUseStore>>(true)

const { getStore: getMinimalStore } = defineStore('minimal', {
  state: () => ({
    dummy: true
  })
})
const minimalStore = getMinimalStore()

// @ts-expect-error
minimalStore.nonExistent
