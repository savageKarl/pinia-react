import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from 'pinia-react'

describe('$store.patch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const useStore = defineStore('main', {
    state: () => ({
      a: true,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      },
      list: [] as number[]
    })
  })

  const useArrayStore = defineStore('main', {
    state: () => ({
      items: [{ id: 0 }],
      currentItem: { id: 1 }
    })
  })

  it('patches a property without touching the rest', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch({ a: false })
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

  it('replaces whole arrays', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch({ list: [1, 2] })
    })

    expect(result.current.$state.list).toEqual([1, 2])
    expect(result.current.list).toEqual([1, 2])
  })

  it('can patch an item that has been copied to an array', () => {
    const { result } = renderHook(() => useArrayStore())

    act(() => {
      result.current.$state.currentItem = { id: 2 }
      result.current.items.push(result.current.currentItem)
      result.current.$state.currentItem = { id: 3 }
    })

    expect(result.current.$state.items).toEqual([{ id: 0 }, { id: 2 }])
    expect(result.current.items).toEqual([{ id: 0 }, { id: 2 }])
  })

  it('replaces whole nested arrays', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      // @ts-expect-error: new state
      result.current.$patch({ nested: { list: [1, 2] } })
    })

    expect(result.current.$state.nested).toEqual({
      foo: 'foo',
      a: { b: 'string' },
      list: [1, 2]
    })

    act(() => {
      // @ts-expect-error: new state
      result.current.$patch({ nested: { list: [] } })
    })

    expect(result.current.$state.nested).toEqual({
      foo: 'foo',
      a: { b: 'string' },
      list: []
    })
  })

  it('patches using a function', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch((state) => {
        expect(state).toBe(result.current.$state)
        state.a = !state.a
        state?.list?.push(1)
      })
    })

    expect(result.current.$state).toEqual({
      a: false,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      },
      list: [1]
    })
  })

  it('patches a nested property without touching the rest', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch({ nested: { foo: 'bar' } })
    })

    expect(result.current.$state).toEqual({
      a: true,
      nested: {
        foo: 'bar',
        a: { b: 'string' }
      },
      list: []
    })

    act(() => {
      result.current.$patch({ nested: { a: { b: 'hello' } } })
    })

    expect(result.current.$state).toEqual({
      a: true,
      nested: {
        foo: 'bar',
        a: { b: 'hello' }
      },
      list: []
    })
  })

  it('patches multiple properties at the same time', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch({ a: false, nested: { foo: 'hello' } })
    })

    // debugger

    expect(result.current.$state).toEqual({
      a: false,
      nested: {
        foo: 'hello',
        a: { b: 'string' }
      },
      list: []
    })
  })
})
