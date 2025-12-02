import { act, renderHook } from '@testing-library/react'
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
})
