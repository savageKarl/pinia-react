import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const { useStore, getStore } = defineStore('main', {
    state: () => ({
      name: 'Eduardo'
    }),
    getters: {
      upperCaseName(state) {
        return state.name.toUpperCase()
      },
      doubleName(): string {
        return this.upperCaseName + this.upperCaseName
      }
    }
  })

  it('adds getters to the store', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.upperCaseName).toBe('EDUARDO')
    expect(result.current.doubleName).toBe('EDUARDOEDUARDO')
  })

  it('updates getters when state changes', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      getStore().$patch({ name: 'Ed' })
    })

    expect(result.current.upperCaseName).toBe('ED')
    expect(result.current.doubleName).toBe('EDED')
  })

  it('caches getter results', () => {
    const getterFn = vi.fn((state) => state.name.toUpperCase())
    const { useStore: useTestStore } = defineStore('test', {
      state: () => ({ name: 'test' }),
      getters: { upper: getterFn }
    })

    const { result } = renderHook(() => useTestStore())
    expect(result.current.upper).toBe('TEST')
    expect(result.current.upper).toBe('TEST')
    expect(getterFn).toHaveBeenCalledTimes(1)
  })

  it('invalidates cache when dependency changes', () => {
    const getterFn = vi.fn((state) => state.name.toUpperCase())
    const { useStore: useTestStore, getStore: getTestStore } = defineStore('test', {
      state: () => ({ name: 'test' }),
      getters: { upper: getterFn }
    })

    const { result } = renderHook(() => useTestStore())
    expect(result.current.upper).toBe('TEST')
    expect(getterFn).toHaveBeenCalledTimes(1)

    act(() => {
      getTestStore().$patch({ name: 'new' })
    })

    expect(result.current.upper).toBe('NEW')
    expect(getterFn).toHaveBeenCalledTimes(2)
  })
})
