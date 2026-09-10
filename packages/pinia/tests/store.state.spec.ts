import { act, renderHook } from '@testing-library/react'
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

  it('prevents direct mutations through $state at every depth', () => {
    const { result } = renderHook(() => useStore())

    expect(() => {
      ;(result.current.$state as any).name = 'Ed'
    }).toThrow()
    expect(() => {
      ;(result.current.$state as any).nested.n = 1
    }).toThrow()
    expect(() => {
      delete (result.current.$state as any).nested.n
    }).toThrow()

    expect(result.current.$state).toEqual({ name: 'Eduardo', nested: { n: 0 } })
  })

  it('prevents mutating arrays exposed through $state', () => {
    const { useStore: useArrayStore } = defineStore('readonly-array-state', {
      state: () => ({ items: ['first'] })
    })
    const { result } = renderHook(() => useArrayStore())

    expect(() => {
      ;(result.current.$state.items as any).push('second')
    }).toThrow()
    expect(result.current.$state.items).toEqual(['first'])
  })

  it('tracks state read through $state and re-renders after a controlled mutation', () => {
    const { result } = renderHook(() => {
      const store = useStore()
      return { value: store.$state.nested.n, increment: () => store.$patch((state) => state.nested.n++) }
    })

    expect(result.current.value).toBe(0)
    act(() => result.current.increment())
    expect(result.current.value).toBe(1)
  })

  it('keeps Date behaviour when stored in state', () => {
    const { useStore: useDateStore } = defineStore('date-state', {
      state: () => ({ when: new Date('2020-01-01T00:00:00.000Z') })
    })
    const { result } = renderHook(() => useDateStore())
    expect(result.current.when.getUTCFullYear()).toBe(2020)
  })

  it('keeps Map behaviour when stored in state', () => {
    const { useStore: useMapStore } = defineStore('map-state', {
      state: () => ({ lookup: new Map<string, number>([['a', 1]]) })
    })
    const { result } = renderHook(() => useMapStore())
    expect(result.current.lookup.get('a')).toBe(1)
  })

  it('keeps Set behaviour when stored in state', () => {
    const { useStore: useSetStore } = defineStore('set-state', {
      state: () => ({ tags: new Set<string>(['x']) })
    })
    const { result } = renderHook(() => useSetStore())
    expect(result.current.tags.has('x')).toBe(true)
  })
})
