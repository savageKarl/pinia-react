import { act, renderHook, waitFor } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Store Actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const { useStore: useCounterStore } = defineStore('counter', {
    state: () => ({ count: 0 }),
    actions: {
      incrementAndGetValue() {
        this.count++
        return this.count
      },
      async rejects() {
        return Promise.reject('Async action failed')
      },
      async updateAfterAwait(name: string) {
        this.count++
        await Promise.resolve()
        this.count++
        return name
      }
    }
  })

  const { useStore: useStoreA, getStore: getStoreA } = defineStore('storeA', {
    state: () => ({ id: 'A' })
  })

  const { useStore: useStoreB } = defineStore('storeB', {
    state: () => ({ id: 'B' }),
    actions: {
      swapWithA() {
        const storeA = getStoreA()
        const currentAId = storeA.id
        storeA.$patch((draft) => {
          draft.id = this.id
        })
        this.id = currentAId
      }
    }
  })

  it('actions should return their values', () => {
    const { result } = renderHook(() => useCounterStore())
    let value: number | undefined
    act(() => {
      value = result.current.incrementAndGetValue()
    })
    expect(value).toBe(1)
    expect(result.current.count).toBe(1)
  })

  it('can interact with other stores within actions', () => {
    const { result: a } = renderHook(() => useStoreA())
    const { result: b } = renderHook(() => useStoreB())
    act(() => {
      b.current.swapWithA()
    })
    expect(a.current.id).toBe('B')
    expect(b.current.id).toBe('A')
  })

  it('should correctly propagate async rejections', async () => {
    const { result } = renderHook(() => useCounterStore())
    await expect(result.current.rejects()).rejects.toBe('Async action failed')
  })

  it('commits mutations before and after await in an async action', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const events: string[] = []
    pinia.onMutation((event) => events.push(event.meta.action ?? event.meta.type))
    const { result } = renderHook(() => useCounterStore())

    let value: string | undefined
    await act(async () => {
      value = await result.current.updateAfterAwait('done')
    })

    expect(value).toBe('done')
    expect(result.current.count).toBe(2)
    expect(events).toEqual(['updateAfterAwait', 'updateAfterAwait'])
  })

  it('supports nested object and array mutations after await', async () => {
    const { useStore } = defineStore('async-nested', {
      state: () => ({ profile: { name: 'before' }, items: [] as string[] }),
      actions: {
        async load() {
          await Promise.resolve()
          this.profile.name = 'after'
          this.items.push('loaded')
        }
      }
    })
    const { result } = renderHook(() => useStore())

    await act(async () => result.current.load())

    await waitFor(() => {
      expect(result.current.profile.name).toBe('after')
      expect(result.current.items).toEqual(['loaded'])
    })
  })

  it('can read getters and call other actions after await', async () => {
    const { useStore } = defineStore('async-context', {
      state: () => ({ count: 1, values: [] as number[] }),
      getters: {
        double(): number {
          return this.count * 2
        }
      },
      actions: {
        increment() {
          this.count++
        },
        async update() {
          await Promise.resolve()
          this.increment()
          this.values.push(this.double)
          this.$patch((state) => {
            state.count++
          })
        }
      }
    })
    const { result } = renderHook(() => useStore())

    await act(async () => result.current.update())

    expect(result.current.count).toBe(3)
    expect(result.current.values).toEqual([4])
    expect(result.current.double).toBe(6)
  })

  it('notifies subscribers for mutations after await', async () => {
    const { getStore } = defineStore('async-subscribe', {
      state: () => ({ count: 0 }),
      actions: {
        async incrementTwice() {
          await Promise.resolve()
          this.count++
          this.count++
        }
      }
    })
    const store = getStore()
    const subscriber = vi.fn()
    store.$subscribe(subscriber)

    await store.incrementTwice()

    expect(store.count).toBe(2)
    expect(subscriber).toHaveBeenCalledTimes(2)
    expect(subscriber).toHaveBeenNthCalledWith(1, { count: 1 }, { count: 0 })
    expect(subscriber).toHaveBeenNthCalledWith(2, { count: 2 }, { count: 1 })
  })
})
