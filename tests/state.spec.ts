import { act, renderHook } from '@testing-library/react'
import { defineStore } from '../src'

describe('state', () => {
  const useStore = defineStore('main', {
    state: () => ({
      name: 'Eduardo',
      counter: 0,
      nested: { n: 0 }
    })
  })

  beforeEach(() => {
    const { result } = renderHook(() => useStore())
    act(() => {
      result.current.$reset()
    })
  })

  it('can directly access state at the store level', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.name).toBe('Eduardo')

    act(() => {
      result.current.name = 'Ed'
    })

    expect(result.current.name).toBe('Ed')
  })

  it('can be set with patch', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch({ name: 'a' })
    })

    expect(result.current.name).toBe('a')
    expect(result.current.$state.name).toBe('a')
  })

  it('can be set on store', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.name = 'a'
    })

    expect(result.current.name).toBe('a')
    expect(result.current.$state.name).toBe('a')
  })

  it('can be set on store.$state', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$state.name = 'a'
    })

    expect(result.current.name).toBe('a')
    expect(result.current.$state.name).toBe('a')
  })

  it('can be nested set with patch', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch({ nested: { n: 3 } })
    })

    expect(result.current.nested.n).toBe(3)
    expect(result.current.$state.nested.n).toBe(3)
  })

  it('can be nested set on store', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.nested.n = 3
    })

    expect(result.current.nested.n).toBe(3)
    expect(result.current.$state.nested.n).toBe(3)
  })

  it('can be nested set on store.$state', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$state.nested.n = 3
    })

    expect(result.current.nested.n).toBe(3)
    expect(result.current.$state.nested.n).toBe(3)
  })
})
