import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('store.$patch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const { useStore } = defineStore('main', {
    state: () => ({
      a: true,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      },
      list: [] as number[]
    })
  })

  it('patches a property without touching the rest', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch((draft) => {
        draft.a = false
      })
    })

    expect(result.current.$state).toEqual({
      a: false,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      },
      list: []
    })
    expect(result.current.a).toBe(false)
  })

  it('patches a nested property without touching the rest', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch((draft) => {
        draft.nested.foo = 'bar'
      })
    })

    expect(result.current.$state).toEqual({
      a: true,
      nested: {
        foo: 'bar',
        a: { b: 'string' }
      },
      list: []
    })
  })

  it('patches multiple properties at the same time', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch((draft) => {
        draft.a = false
        draft.nested.foo = 'hello'
      })
    })

    expect(result.current.$state).toEqual({
      a: false,
      nested: {
        foo: 'hello',
        a: { b: 'string' }
      },
      list: []
    })
  })

  it('replaces whole arrays', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch((draft) => {
        draft.list = [1, 2, 3]
      })
    })

    expect(result.current.list).toEqual([1, 2, 3])
  })

  it('patches using a function with immer draft', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch((draft) => {
        draft.a = !draft.a
        draft.list.push(1)
        draft.nested.foo = 'baz'
      })
    })

    expect(result.current.$state).toEqual({
      a: false,
      nested: {
        foo: 'baz',
        a: { b: 'string' }
      },
      list: [1]
    })
  })
})
