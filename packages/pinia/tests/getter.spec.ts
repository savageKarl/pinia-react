import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from 'pinia-react'

describe('Getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const useStore = defineStore('main', {
    state: () => ({
      name: 'Eduardo'
    }),
    getters: {
      upperCaseName(store) {
        return store.name.toUpperCase()
      },
      doubleName(): string {
        return this.upperCaseName
      },
      composed() {
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

  const useB = defineStore('B', { state: () => ({ b: 'b' }) })

  const useA = defineStore('A', {
    state: () => ({ a: 'a' }),
    getters: {
      fromB(): string {
        const bStore = useB.$getStore()
        return this.a + ' ' + bStore.b
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

  it('supports changing between applications', async () => {
    const pinia1 = createPinia()
    const pinia2 = createPinia()

    const { result: aResult } = renderHook(() => {
      setActivePinia(pinia1)
      return useA()
    })

    const { result: bResult } = renderHook(() => {
      setActivePinia(pinia2)
      return useB()
    })

    const aStore = aResult.current
    const bStore = bResult.current

    await act(async () => {
      bStore.b = 'c'
    })

    await act(async () => {
      aStore.a = 'b'
    })

    expect(aStore.a).toBe('b')

    expect(aStore.fromB).toBe('b b')

    expect(bStore.b).toBe('c')
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
