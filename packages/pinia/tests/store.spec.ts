import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('reuses a store instance', () => {
    const { useStore: useMainStore } = defineStore('main', {})
    const { result: r1 } = renderHook(() => useMainStore())
    const { result: r2 } = renderHook(() => useMainStore())

    expect(r1.current).toBe(r2.current)
  })

  it('sets the initial state', () => {
    const { useStore } = defineStore('main', {
      state: () => ({ a: true, b: 'hello' })
    })
    const { result } = renderHook(() => useStore())

    expect(result.current.$state).toEqual({ a: true, b: 'hello' })
  })

  it('subscribes to state changes', () => {
    const { useStore, getStore } = defineStore('main', {
      state: () => ({ a: false })
    })
    const { result } = renderHook(() => useStore())

    const spy = vi.fn()
    let unsubscribe: () => void

    act(() => {
      unsubscribe = getStore().$subscribe(spy)
    })

    act(() => {
      getStore().$patch({ a: true })
    })

    expect(spy).toHaveBeenCalledTimes(1)

    act(() => {
      unsubscribe()
      getStore().$patch({ a: false })
    })

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('creates an empty state if no state option is provided', () => {
    const { useStore } = defineStore('empty', {})
    const { result } = renderHook(() => useStore())

    expect(result.current.$state).toEqual({})
  })
})
