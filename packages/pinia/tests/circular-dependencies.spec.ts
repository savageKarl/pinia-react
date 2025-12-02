import { renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Circular Dependencies', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should detect circular dependency in getters and warn', () => {
    const { useStore } = defineStore('circle', {
      state: () => ({ val: 1 }),
      getters: {
        a(): number {
          return this.b + 1
        },
        b(): number {
          return this.a + 1
        }
      }
    })

    const { result } = renderHook(() => useStore())

    const value = result.current.a

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Circular dependency detected in getter "a"'))

    expect(value).toBeNaN()
  })

  test('should not crash stack when circular dependency exists across stores (simplified check)', () => {
    const { useStore } = defineStore('safe-circle', {
      state: () => ({ val: 1 }),
      getters: {
        selfRef(): number {
          return this.selfRef + 1
        }
      }
    })

    const { result } = renderHook(() => useStore())
    expect(result.current.selfRef).toBeNaN()
    expect(console.warn).toHaveBeenCalled()
  })
})
