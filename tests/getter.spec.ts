import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const useStore = defineStore('main', {
    state: () => ({
      name: 'Eduardo'
    }),
    getters: {
      upperCaseName() {
        return this.name.toUpperCase()
      },
      doubleName(): string {
        return this.upperCaseName
      },
      composed(): string {
        // // debugger
        return this.upperCaseName + ': ok'
      },
      arrowUpper(): string {
        return this.name.toUpperCase()
      }
    },
    actions: {
      o() {
        this.arrowUpper.toUpperCase()
        this.o().toUpperCase()
        return 'a string'
      }
    }
  })

  it('adds getters to the store', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.upperCaseName).toBe('EDUARDO')

    act(() => {
      result.current.name = 'Ed'
    })

    expect(result.current.upperCaseName).toBe('ED')
  })

  it('updates the value', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.name = 'Ed'
    })

    expect(result.current.upperCaseName).toBe('ED')
  })

  it('can use other getters', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.composed).toBe('EDUARDO: ok')

    act(() => {
      result.current.name = 'Ed'
    })

    expect(result.current.composed).toBe('ED: ok')
  })
})
