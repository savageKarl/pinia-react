import { renderHook } from '@testing-library/react'
import { createPinia, defineStore, type PiniaPluginContext, setActivePinia } from '../src'

declare module '../src' {
  export interface PiniaCustomProperties {
    secret?: string
    greet?: () => string
  }
}

describe('Advanced Plugins', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  test('plugin should be able to extend store with return properties', () => {
    const pinia = createPinia()

    pinia.use(() => {
      return {
        secret: 'my-secret-key',
        greet: () => 'hello world'
      }
    })

    setActivePinia(pinia)

    const { useStore } = defineStore('main', {
      state: () => ({ count: 0 })
    })

    const { result } = renderHook(() => useStore())

    expect(result.current.secret).toBe('my-secret-key')
    expect(result.current.greet!()).toBe('hello world')
  })

  test('plugin context should provide options and store', () => {
    const pinia = createPinia()
    const pluginSpy = vi.fn()

    pinia.use((ctx: PiniaPluginContext) => {
      pluginSpy(ctx)
    })

    setActivePinia(pinia)

    const { useStore } = defineStore('ctx-test', {
      state: () => ({ id: 1 })
    })

    renderHook(() => useStore())

    expect(pluginSpy).toHaveBeenCalled()
    const ctx = pluginSpy.mock.calls[0][0]

    expect(ctx.id).toBe('ctx-test')
    expect(ctx.options.state()).toEqual({ id: 1 })
    expect(ctx.store.$state).toEqual({ id: 1 })
  })
})
