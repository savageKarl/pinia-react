import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

declare module '../src' {
  export interface PiniaCustomProperties {
    shared: number
  }
}

describe('Store Plugins', () => {
  it('shares properties with getters/setters across multiple stores', () => {
    const pinia = createPinia()
    let shared = 0
    pinia.use(() => ({
      get shared() {
        return shared
      },
      set shared(value: number) {
        shared = value
      }
    }))
    setActivePinia(pinia)

    const { useStore: useStoreA } = defineStore('a', { state: () => ({}) })
    const { useStore: useStoreB } = defineStore('b', { state: () => ({}) })
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

  it('warns when a plugin is registered after stores were created', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pinia = createPinia()
    setActivePinia(pinia)

    const { getStore } = defineStore('early-store', { state: () => ({ n: 1 }) })
    getStore()
    pinia.use(() => ({}))

    expect(warnSpy).toHaveBeenCalled()
  })
})
