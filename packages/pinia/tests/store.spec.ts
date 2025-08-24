import { act, renderHook, waitFor } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from 'pinia-react'

describe('Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const useStore = defineStore('main', {
    state: () => ({
      a: true,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      }
    })
  })

  it('reuses a store', () => {
    const useStore = defineStore('main', {})
    const { result: result1 } = renderHook(() => useStore())
    const { result: result2 } = renderHook(() => useStore())
    expect(result1.current).toBe(result2.current)
  })

  it('works with id as first argument', () => {
    const useStore = defineStore('main', {
      state: () => ({
        a: true,
        nested: {
          foo: 'foo',
          a: { b: 'string' }
        }
      })
    })
    const { result: result1 } = renderHook(() => useStore())
    const { result: result2 } = renderHook(() => useStore())
    expect(result1.current).toBe(result2.current)

    const useStoreEmpty = defineStore('main', {})
    const { result: result3 } = renderHook(() => useStoreEmpty())
    const { result: result4 } = renderHook(() => useStoreEmpty())
    expect(result3.current).toBe(result4.current)
  })

  it('sets the initial state', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.$state).toEqual({
      a: true,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      }
    })
  })

  it('can be reset', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$state.a = false
    })

    const spy = vi.fn()

    act(() => {
      result.current.$subscribe(spy)
    })

    expect(spy).not.toHaveBeenCalled()

    act(() => {
      result.current.$reset()
    })

    expect(spy).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.$state.nested.foo = 'bar'
    })

    waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2)
      expect(result.current.$state).toEqual({
        a: true,
        nested: {
          foo: 'bar',
          a: { b: 'string' }
        }
      })

      expect(result.current.nested.foo).toBe('bar')
    })
  })

  it('can create an empty state if no state option is provided', () => {
    const useEmptyStore = defineStore('some', {})
    const { result } = renderHook(() => useEmptyStore())

    expect(result.current.$state).toEqual({})
  })
})
