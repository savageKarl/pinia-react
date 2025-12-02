import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Store Edge Cases', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('actions should be able to access other actions and $patch via this', () => {
    const { useStore } = defineStore('actions-context', {
      state: () => ({ count: 0, history: [] as number[] }),
      actions: {
        rawIncrement() {
          this.count++
        },
        complexAction() {
          this.rawIncrement()
          this.$patch((state) => {
            state.history.push(state.count)
          })
        }
      }
    })

    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.complexAction()
    })

    expect(result.current.count).toBe(1)
    expect(result.current.history).toEqual([1])
  })

  test('accessing symbol keys on store proxy should work', () => {
    const { useStore } = defineStore('symbol-test', {
      state: () => ({ val: 'test' })
    })

    const { result } = renderHook(() => useStore())
    const sym = Symbol('custom-symbol')

    expect(() => {
      const _ = (result.current as any)[sym]
    }).not.toThrow()
  })

  test('using Symbol.iterator or similar built-ins should not crash', () => {
    const { useStore } = defineStore('iterator-test', {
      state: () => ({ items: [1, 2] })
    })

    const { result } = renderHook(() => useStore())

    expect(() => {
      const _ = (result.current as any)[Symbol.iterator]
    }).not.toThrow()
  })

  test('actions should be able to access getters via this', () => {
    const { useStore } = defineStore('action-getter', {
      state: () => ({ count: 1 }),
      getters: {
        double(): number {
          return this.count * 2
        }
      },
      actions: {
        incrementAndCheckDouble() {
          this.count++
          return this.double
        }
      }
    })

    const { result } = renderHook(() => useStore())
    let doubleVal = 0

    act(() => {
      doubleVal = result.current.incrementAndCheckDouble()
    })

    expect(result.current.count).toBe(2)
    expect(doubleVal).toBe(4)
  })
})
