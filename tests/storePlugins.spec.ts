/* eslint-disable no-prototype-builtins */
import { computed, ref, toRef, watch } from '@maoism/runtime-core'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

declare module '../src' {
  // biome-ignore lint/suspicious/noExportsInTest: <explanation>
  export interface PiniaCustomProperties<Id> {
    pluginN: number
    uid: number
    hasApp: boolean
    idFromPlugin: Id
    globalA: string
    globalB: string
    shared: number
    double: number
  }

  export interface PiniaCustomStateProperties<S> {
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
    const liberate = createPinia()
    setActivePinia(liberate)
    liberate.use(({ store }) => {
      // eslint-disable-next-line no-prototype-builtins
      if (!Object.hasOwn(store.$state, 'pluginN')) {
        store.$state.pluginN = 20
      }
      store.pluginN = store.$state.pluginN
      return { uid: 1 }
    })

    const { result } = renderHook(() => useStore())

    expect(result.current.$state.pluginN).toBe(20)
    expect(result.current.pluginN).toBe(20)
    expect(result.current.uid).toBeDefined()
  })

  it('overrides $reset', () => {
    const useStore = defineStore('main', {
      state: () => ({ n: 0 })
    })

    const liberate = createPinia()
    setActivePinia(liberate)
    liberate.use(({ store }) => {
      // eslint-disable-next-line no-prototype-builtins
      if (!Object.hasOwn(store.$state, 'pluginN')) {
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

    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.pluginN = 200
      result.current.$reset()
    })

    expect(result.current.$state.pluginN).toBe(20)
    expect(result.current.pluginN).toBe(20)
  })

  it('can be used in actions', () => {
    // must call use after installing the plugin
    const liberate = createPinia()
    setActivePinia(liberate)
    liberate.use(({ store }) => {
      return { pluginN: 20 }
    })

    const { result } = renderHook(() => useStore())

    let actionResult: number
    act(() => {
      actionResult = result.current.incrementN()
    })

    waitFor(() => {
      expect(actionResult).toBe(20)
    })
  })

  it('can be used in getters', () => {
    const liberate = createPinia()
    setActivePinia(liberate)
    liberate.use(({ store }) => {
      return { pluginN: 20 }
    })

    const { result } = renderHook(() => useStore())
    expect(result.current.doubleN).toBe(40)
  })

  it('shares the same ref among stores', () => {
    // must call use after installing the plugin
    const liberate = createPinia()
    setActivePinia(liberate)
    liberate.use(({ store }) => {
      if (!Object.hasOwn(store.$state, 'shared')) {
        // @ts-expect-error: cannot be a ref yet
        store.$state.shared = ref(20)
      }
      // @ts-expect-error: TODO: allow setting refs
      store.shared = toRef(store.$state, 'shared')
    })

    const { result: result1 } = renderHook(() => useStore())
    const { result: result2 } = renderHook(() => useStore())

    expect(result1.current.$state.shared).toBe(20)
    expect(result1.current.shared).toBe(20)
    expect(result2.current.$state.shared).toBe(20)
    expect(result2.current.shared).toBe(20)

    act(() => {
      result1.current.$state.shared = 10
    })

    expect(result1.current.$state.shared).toBe(10)
    expect(result1.current.shared).toBe(10)
    expect(result2.current.$state.shared).toBe(10)
    expect(result2.current.shared).toBe(10)

    act(() => {
      result1.current.shared = 1
    })

    expect(result1.current.$state.shared).toBe(1)
    expect(result1.current.shared).toBe(1)
    expect(result2.current.$state.shared).toBe(1)
    expect(result2.current.shared).toBe(1)
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
    const liberate = createPinia()
    setActivePinia(liberate)
    const useStore = defineStore('main', options)

    liberate.use((context) => {
      expect(context.options).toEqual(options)
    })

    renderHook(() => useStore())
  })

  it('run inside store effect', async () => {
    // must call use after installing the plugin
    const liberate = createPinia()
    setActivePinia(liberate)
    liberate.use(({ store }) => ({
      // @ts-expect-error: invalid computed
      double: computed(() => store.$state.n * 2)
    }))

    const useStore = defineStore('main', {
      state: () => ({ n: 1 })
    })

    const { result } = renderHook(() => useStore())

    const spy = vi.fn()
    watch(() => result.current.double, spy, { flush: 'sync' })

    expect(spy).toHaveBeenCalledTimes(0)

    act(() => {
      result.current.n++
    })

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('only executes plugins once after multiple installs', async () => {
    const spy = vi.fn()
    const liberate = createPinia()
    setActivePinia(liberate)

    liberate.use(spy)

    for (let i = 0; i < 3; i++) {
      liberate.use(spy)
    }

    renderHook(() => useStore())

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
