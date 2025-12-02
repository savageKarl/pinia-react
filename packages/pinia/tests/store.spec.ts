import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Store Core', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('useStore hooks return different proxies but share the same underlying store state', () => {
    const { useStore: useMainStore, getStore: getMainStore } = defineStore('main', { state: () => ({}) })
    const { result: r1 } = renderHook(() => useMainStore())
    const { result: r2 } = renderHook(() => useMainStore())

    expect(r1.current).not.toBe(r2.current)
    expect(r1.current.$state).toBe(r2.current.$state)
    expect(getMainStore()).toBe(getMainStore())
  })

  it('sets the initial state correctly', () => {
    const { useStore } = defineStore('main', {
      state: () => ({ a: true, b: 'hello' })
    })
    const { result } = renderHook(() => useStore())
    expect(result.current.$state).toEqual({ a: true, b: 'hello' })
  })

  it('creates an empty state if state function returns empty object', () => {
    const { useStore } = defineStore('empty', { state: () => ({}) })
    const { result } = renderHook(() => useStore())
    expect(result.current.$state).toEqual({})
  })

  it('subscribes to state changes via $subscribe', () => {
    const { useStore, getStore } = defineStore('main', {
      state: () => ({ value: 0 }),
      actions: {
        inc() {
          this.value++
        }
      }
    })
    renderHook(() => useStore())
    const spy = vi.fn()
    const unsubscribe = getStore().$subscribe(spy)

    act(() => {
      getStore().inc()
    })

    expect(spy).toHaveBeenCalledTimes(1)
    unsubscribe()
    act(() => {
      getStore().inc()
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
