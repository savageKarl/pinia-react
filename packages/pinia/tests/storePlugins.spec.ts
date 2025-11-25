import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

declare module '../src' {
  export interface PiniaCustomProperties {
    pluginValue: number
    shared: number
  }
}

describe('Store Plugins', () => {
  it('adds properties to stores', () => {
    const pinia = createPinia()
    pinia.use(() => ({ pluginValue: 42 }))
    setActivePinia(pinia)

    const { useStore } = defineStore('main', {})
    const { result } = renderHook(() => useStore())

    expect(result.current.pluginValue).toBe(42)
  })

  it('allows plugins to access store context', () => {
    const pinia = createPinia()
    const plugin = vi.fn()
    pinia.use(plugin)
    setActivePinia(pinia)

    const options = { state: () => ({ n: 0 }) }
    const { useStore, getStore } = defineStore('test', options)
    renderHook(() => useStore())

    expect(plugin).toHaveBeenCalledTimes(1)
    const context = plugin.mock.calls[0][0]
    expect(context.id).toBe('test')
    expect(context.options).toEqual(options)
    expect(context.store).toBe(getStore())
  })

  it('can be used in actions', () => {
    const pinia = createPinia()
    pinia.use(() => ({ pluginValue: 10 }))
    setActivePinia(pinia)

    const { useStore } = defineStore('main', {
      state: () => ({ count: 0 }),
      actions: {
        incrementByPluginValue() {
          this.count += this.pluginValue
        }
      }
    })
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.incrementByPluginValue()
    })

    expect(result.current.count).toBe(10)
  })

  it('shares properties across stores', () => {
    const pinia = createPinia()
    let shared = 0
    pinia.use(() => ({
      get shared() {
        return shared
      },
      set shared(value) {
        shared = value
      }
    }))
    setActivePinia(pinia)

    const { useStore: useStoreA } = defineStore('a', {})
    const { useStore: useStoreB } = defineStore('b', {})
    const { result: resultA } = renderHook(() => useStoreA())
    const { result: resultB } = renderHook(() => useStoreB())

    expect(resultA.current.shared).toBe(0)
    expect(resultB.current.shared).toBe(0)

    act(() => {
      resultA.current.shared = 5
    })

    expect(resultA.current.shared).toBe(5)
    expect(resultB.current.shared).toBe(5)
  })
})
