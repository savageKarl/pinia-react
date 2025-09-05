import type { UnwrapRef } from '@maoism/runtime-core'
import { defineStore, expectType } from '.'

const useStore = defineStore('name', {
  state: () => ({ a: 'on' as 'on' | 'off', nested: { counter: 0 } }),
  getters: {
    upper: (state) => {
      expectType<'on' | 'off'>(state.a)
      return state.a.toUpperCase() as 'ON' | 'OFF'
    },
    upperThis(): 'ON' | 'OFF' {
      expectType<'on' | 'off'>(this.a)
      return this.a.toUpperCase() as 'ON' | 'OFF'
    },
    other(): false {
      expectType<string>(this.upper)
      return false
    },

    doubleCounter: (state) => {
      expectType<number>(state.nested.counter)
      return state.nested.counter * 2
    }
  },
  actions: {
    doStuff() {
      // @ts-expect-error
      this.notExisting
      expectType<string>(this.upper)
      expectType<false>(this.other)
    },
    otherOne() {
      expectType<() => void>(this.doStuff)
    }
  }
})

defineStore('name', {})
// @ts-expect-error
defineStore('name')
defineStore('name', {
  state: () => ({})
})

// actions on not existing properties
defineStore('', {
  actions: {
    a() {
      // @ts-expect-error
      this.notExisting
    }
  }
})

defineStore('', {
  state: () => ({}),
  actions: {
    a() {
      // @ts-expect-error
      this.notExisting
    }
  }
})

defineStore('', {
  getters: {},
  actions: {
    a() {
      // @ts-expect-error
      this.notExisting
    }
  }
})

interface Model {
  id: number
}

// Define generic factory function
export function init<User extends Model>(name = 'settings') {
  return defineStore(name, {
    state: () => {
      return {
        // Set one of the properties to the generic type
        user: {} as User
      }
    },
    actions: {
      // Add action which accepts argument with our generic type
      set(u: UnwrapRef<User>) {
        // See linter error when trying to assign arg value to the state
        this.user = u
      }
    }
  })
}

const s = init()()
s.set({ id: 1 })

// getters on not existing properties
defineStore('', {
  getters: {
    a(): number {
      // @ts-expect-error
      this.notExisting
      return 2
    },
    b: (state) => {
      // @ts-expect-error
      state.notExisting
      return
    }
  }
})

defineStore('', {
  state: () => ({}),
  getters: {
    a(): number {
      // @ts-expect-error
      this.notExisting
      return 2
    },
    b: (state) => {
      // @ts-expect-error
      state.notExisting
      return
    }
  }
})

const store = useStore.$getStore()

// if (import.meta.hot) {
//   import.meta.hot.accept(acceptHMRUpdate(useStore, import.meta.hot))
// }

expectType<{ a: 'on' | 'off' }>(store.$state)
expectType<number>(store.nested.counter)
expectType<'on' | 'off'>(store.a)
expectType<'ON' | 'OFF'>(store.upper)

// @ts-expect-error
store.nonExistant

// @ts-expect-error
store.upper = 'thing'

// @ts-expect-error
store.nonExistant.stuff

// @ts-expect-error cannot return a value
store.$patch(async () => {})
store.$patch(() => {})
store.$patch(() => {
  // return earlier
  return
})

const useNoSAG = defineStore('noSAG', {})
const useNoAG = defineStore('noAG', { state: () => ({}) })
const useNoSG = defineStore('noAG', { actions: {} })
const useNoSA = defineStore('noAG', { getters: {} })
const useNoS = defineStore('noAG', { actions: {}, getters: {} })
const useNoA = defineStore('noAG', { state: () => ({}), getters: {} })
const useNoG = defineStore('noAG', { state: () => ({}), actions: {} })

const noSAG = useNoSAG.$getStore()
const noSA = useNoSA.$getStore()
const noAG = useNoAG.$getStore()
const noSG = useNoSG.$getStore()
const noS = useNoS.$getStore()
const noA = useNoA.$getStore()
const noG = useNoG.$getStore()

// @ts-expect-error
store.notExisting

// @ts-expect-error
noSAG.notExisting
// @ts-expect-error
noSAG.$state.hey

// @ts-expect-error
noSA.notExisting
// @ts-expect-error
noSA.notExisting
// @ts-expect-error
noAG.notExisting
// @ts-expect-error
noSG.notExisting
// @ts-expect-error
noS.notExisting
// @ts-expect-error
noA.notExisting
// @ts-expect-error
noG.notExisting
