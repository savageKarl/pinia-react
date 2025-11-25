import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('store.$reset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const { useStore, getStore } = defineStore('main', {
    state: () => ({
      name: 'Eduardo',
      nested: { n: 0 }
    })
  })

  it('can reset the state to its initial value', () => {
    const { result } = renderHook(() => useStore())
    const store = getStore()

    act(() => {
      store.$patch({ name: 'Ed', nested: { n: 1 } })
    })

    expect(result.current.name).toBe('Ed')
    expect(result.current.nested.n).toBe(1)

    act(() => {
      store.$reset()
    })

    expect(result.current.name).toBe('Eduardo')
    expect(result.current.nested.n).toBe(0)
  })

  it('can reset the state of a store with no initial state', () => {
    const { useStore: useEmptyStore, getStore: getEmptyStore } = defineStore('empty', {})
    const { result } = renderHook(() => useEmptyStore())

    expect(result.current.$state).toEqual({})

    act(() => {
      getEmptyStore().$reset()
    })

    expect(result.current.$state).toEqual({})
  })
})
