import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const useStore = defineStore('main', {
    state: () => ({
      a: true,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      }
    }),
    getters: {
      nonA(): boolean {
        return !this.a
      },
      otherComputed() {
        return this.nonA
      }
    },
    actions: {
      async getNonA() {
        return this.nonA
      },
      simple() {
        this.toggle()
        return 'simple'
      },

      toggle() {
        this.a = !this.a
        return this.a
      },

      setFoo(foo: string) {
        this.$patch({ nested: { foo } })
      },

      combined() {
        this.toggle()
        this.setFoo('bar')
      },

      throws() {
        throw new Error('fail')
      },

      async rejects() {
        throw 'fail'
      }
    }
  })

  it('can use the store as this', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.a).toBe(true)

    act(() => {
      result.current.toggle()
    })

    expect(result.current.a).toBe(false)
  })

  it('store is forced as the context', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.$state.a).toBe(true)
    expect(() => {
      result.current.toggle.call(null)
    }).not.toThrow()
    expect(result.current.$state.a).toBe(false)
  })

  it('can call other actions', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.$state.a).toBe(true)
    expect(result.current.$state.nested.foo).toBe('foo')

    act(() => {
      result.current.combined()
    })

    expect(result.current.$state.a).toBe(false)
    expect(result.current.$state.nested.foo).toBe('bar')
  })

  it('throws errors', () => {
    const { result } = renderHook(() => useStore())
    expect(() => result.current.throws()).toThrowError('fail')
  })

  it('throws async errors', async () => {
    const { result } = renderHook(() => useStore())
    expect.assertions(1)
    await expect(result.current.rejects()).rejects.toBe('fail')
  })

  it('can catch async errors', async () => {
    const { result } = renderHook(() => useStore())
    expect.assertions(3)
    const spy = vi.fn()
    await expect(result.current.rejects().catch(spy)).resolves.toBe(undefined)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('fail')
  })

  it('can destructure actions', () => {
    const { result } = renderHook(() => useStore())
    const { simple } = result.current
    expect(simple()).toBe('simple')
    // works with the wrong this
    expect({ simple }.simple()).toBe('simple')
    // special this check
    expect({ $id: 'o', simple }.simple()).toBe('simple')
    // override the function like devtools do
    expect(
      {
        $id: result.current.$id,
        simple,
        // otherwise it would fail
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        toggle() {}
      }.simple()
    ).toBe('simple')
  })
})
