/* eslint-disable no-prototype-builtins */
import { watch, ref, toRef, computed } from '@maoism/runtime-core'

import { defineStore, setActiveLiberate, createLiberate } from '../src'

declare module '../src' {
  export interface LiberateCustomProperties<Id> {
    pluginN: number
    uid: number
    hasApp: boolean
    idFromPlugin: Id
    globalA: string
    globalB: string
    shared: number
    double: number
  }

  export interface LiberateCustomStateProperties<S> {
    // pluginN: 'test' extends Id ? number : never | undefined
    pluginN: number
    shared: number
  }
}

function microTask(fn: () => any) {
  Promise.resolve().then(fn)
}

describe('store plugins', () => {
  const useStore = defineStore('test', {
    actions: {
      incrementN() {
        return this.pluginN++
      }
    },

    getters: {
      doubleN() {
        return this.pluginN * 2
      }
    }
  })

  it('adds properties to stores', () => {
    // must call use after installing the plugin
    const liberate = createLiberate()
    setActiveLiberate(liberate)
    liberate.use(({ store }) => {
      // eslint-disable-next-line no-prototype-builtins
      if (!store.$state.hasOwnProperty('pluginN')) {
        store.$state.pluginN = 20
      }
      store.pluginN = store.$state.pluginN
      return { uid: 1 }
    })

    const store = useStore()

    expect(store.$state.pluginN).toBe(20)
    expect(store.pluginN).toBe(20)
    expect(store.uid).toBeDefined()
  })

  it('overrides $reset', () => {
    const useStore = defineStore('main', {
      state: () => ({ n: 0 })
    })

    const liberate = createLiberate()
    setActiveLiberate(liberate)
    liberate.use(({ store }) => {
      // eslint-disable-next-line no-prototype-builtins
      if (!store.$state.hasOwnProperty('pluginN')) {
        store.$state.pluginN = 20
      }
      store.pluginN = store.$state.pluginN

      const originalReset = store.$reset.bind(store)
      return {
        uid: 1,
        $reset() {
          originalReset()
          store.pluginN = 20
        }
      }
    })

    const store = useStore()

    store.pluginN = 200
    store.$reset()
    expect(store.$state.pluginN).toBe(20)
    expect(store.pluginN).toBe(20)
  })

  it('can be used in actions', () => {
    // must call use after installing the plugin
    const liberate = createLiberate()
    setActiveLiberate(liberate)
    liberate.use(({ store }) => {
      return { pluginN: 20 }
    })

    const store = useStore()

    expect(store.incrementN()).toBe(20)
  })

  it('can be used in getters', () => {
    const liberate = createLiberate()
    setActiveLiberate(liberate)
    liberate.use(({ store }) => {
      return { pluginN: 20 }
    })

    const store = useStore()
    expect(store.doubleN).toBe(40)
  })

  it('shares the same ref among stores', () => {
    // must call use after installing the plugin
    const liberate = createLiberate()
    setActiveLiberate(liberate)
    liberate.use(({ store }) => {
      if (!store.$state.hasOwnProperty('shared')) {
        // @ts-expect-error: cannot be a ref yet
        store.$state.shared = ref(20)
      }
      // @ts-expect-error: TODO: allow setting refs
      store.shared = toRef(store.$state, 'shared')
    })

    const store = useStore()
    const store2 = useStore()

    expect(store.$state.shared).toBe(20)
    expect(store.shared).toBe(20)
    expect(store2.$state.shared).toBe(20)
    expect(store2.shared).toBe(20)

    store.$state.shared = 10
    expect(store.$state.shared).toBe(10)
    expect(store.shared).toBe(10)
    expect(store2.$state.shared).toBe(10)
    expect(store2.shared).toBe(10)

    store.shared = 1
    expect(store.$state.shared).toBe(1)
    expect(store.shared).toBe(1)
    expect(store2.$state.shared).toBe(1)
    expect(store2.shared).toBe(1)
  })

  it('passes the options of the options store', async () => {
    const options = {
      state: () => ({ n: 0 }),
      actions: {
        increment() {
          // @ts-expect-error
          this.n++
        }
      },
      getters: {
        a() {
          return 'a'
        }
      }
    }
    const liberate = createLiberate()
    setActiveLiberate(liberate)
    const useStore = defineStore('main', options)

    liberate.use((context) => {
      expect(context.options).toEqual(options)
    })
    useStore()
  })

  it('run inside store effect', async () => {
    // must call use after installing the plugin
    const liberate = createLiberate()
    setActiveLiberate(liberate)
    liberate.use(({ store }) => ({
      // @ts-expect-error: invalid computed
      double: computed(() => store.$state.n * 2)
    }))

    const useStore = defineStore('main', {
      state: () => ({ n: 1 })
    })

    const store = useStore()

    const spy = vi.fn()
    watch(() => store.double, spy, { flush: 'sync' })

    expect(spy).toHaveBeenCalledTimes(0)

    store.n++
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('only executes plugins once after multiple installs', async () => {
    const spy = vi.fn()
    const liberate = createLiberate()
    setActiveLiberate(liberate)

    liberate.use(spy)

    for (let i = 0; i < 3; i++) {
      liberate.use(spy)
    }

    useStore()

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
