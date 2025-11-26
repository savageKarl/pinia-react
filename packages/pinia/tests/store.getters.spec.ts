import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Store Core', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('useStore hooks return different proxies but share the same underlying store state', () => {
    const { useStore: useMainStore } = defineStore('main', { state: () => ({}) })
    const { result: r1 } = renderHook(() => useMainStore())
    const { result: r2 } = renderHook(() => useMainStore())

    expect(r1.current).not.toBe(r2.current)
    expect(r1.current.$state).toBe(r2.current.$state)
  })
})
