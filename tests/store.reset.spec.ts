import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('store.$reset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const useStore = defineStore('main', {
    state: () => ({
      name: 'Eduardo',
      counter: 0,
      nested: { n: 0 }
    })
  })

  it('can reset the state', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.name = 'Ed'
      result.current.nested.n++
      result.current.$reset()
    })

    expect(result.current.$state).toEqual({
      counter: 0,
      name: 'Eduardo',
      nested: {
        n: 0
      }
    })
  })

  it('can reset the state of an empty store', () => {
    const useEmptyStore = defineStore('a', {})
    const { result } = renderHook(() => useEmptyStore())

    expect(result.current.$state).toEqual({})

    act(() => {
      result.current.$reset()
    })

    expect(result.current.$state).toEqual({})
  })
})
