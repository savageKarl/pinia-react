import { renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Store State', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const { useStore } = defineStore('main', {
    state: () => ({
      name: 'Eduardo',
      nested: { n: 0 }
    })
  })

  it('throws an error when directly mutating a top-level store property', () => {
    const { result } = renderHook(() => useStore())
    expect(() => {
      result.current.name = 'Ed'
    }).toThrow()
    expect(console.warn).toHaveBeenCalledWith('[main] Store is read-only. Use actions for mutations.')
  })

  it('throws an error when directly mutating a nested store property', () => {
    const { result } = renderHook(() => useStore())
    expect(() => {
      result.current.nested.n = 1
    }).toThrow()
    expect(console.warn).toHaveBeenCalledWith('[main] Store is read-only. Use actions for mutations.')
  })

  it('throws an error when replacing .$state', () => {
    const { result } = renderHook(() => useStore())
    expect(() => {
      result.current.$state = { name: 'Ed' } as any
    }).toThrow()
  })
})
