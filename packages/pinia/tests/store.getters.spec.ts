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

  it('invalidates a getter that returns a nested object', () => {
    const getter = vi.fn((state: { user: { profile: { name: string } } }) => state.user.profile)
    const { useStore } = defineStore('object-getter', {
      state: () => ({ user: { profile: { name: 'before' } } }),
      getters: { profile: getter },
      actions: {
        rename(name: string) {
          this.user.profile.name = name
        }
      }
    })
    const { result } = renderHook(() => {
      const store = useStore()
      return { name: store.profile.name, rename: store.rename }
    })

    expect(result.current.name).toBe('before')
    expect(getter).toHaveBeenCalledTimes(1)

    act(() => result.current.rename('after'))

    expect(result.current.name).toBe('after')
    expect(getter).toHaveBeenCalledTimes(2)
  })

  it('invalidates a getter that returns an array when its contents change', () => {
    const { useStore } = defineStore('array-getter', {
      state: () => ({ items: ['first'] }),
      getters: {
        visibleItems: (state) => state.items
      },
      actions: {
        addItem(item: string) {
          this.items.push(item)
        }
      }
    })
    const { result } = renderHook(() => {
      const store = useStore()
      return { count: store.visibleItems.length, addItem: store.addItem }
    })

    expect(result.current.count).toBe(1)
    act(() => result.current.addItem('second'))
    expect(result.current.count).toBe(2)
  })
})
