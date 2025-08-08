import { defineStore, setActiveLiberate, createLiberate } from '../src'

describe('Store', () => {
  beforeEach(() => {
    setActiveLiberate(createLiberate())
  })

  const useStore = defineStore('main', {
    state: () => ({
      a: true,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      }
    })
  })

  it('reuses a store', () => {
    const useStore = defineStore('main', {})
    expect(useStore()).toBe(useStore())
  })

  it('works with id as first argument', () => {
    const useStore = defineStore('main', {
      state: () => ({
        a: true,
        nested: {
          foo: 'foo',
          a: { b: 'string' }
        }
      })
    })
    expect(useStore()).toBe(useStore())
    const useStoreEmpty = defineStore('main', {})
    expect(useStoreEmpty()).toBe(useStoreEmpty())
  })

  it('sets the initial state', () => {
    const store = useStore()
    expect(store.$state).toEqual({
      a: true,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      }
    })
  })

  it('can be reset', () => {
    const store = useStore()
    store.$state.a = false
    const spy = vi.fn()
    store.$subscribe(spy)
    // debugger
    expect(spy).not.toHaveBeenCalled()
    store.$reset()

    expect(spy).toHaveBeenCalledTimes(1)
    store.$state.nested.foo = 'bar'
    expect(spy).toHaveBeenCalledTimes(2)
    expect(store.$state).toEqual({
      a: true,
      nested: {
        foo: 'bar',
        a: { b: 'string' }
      }
    })

    expect(store.nested.foo).toBe('bar')
  })

  it('can create an empty state if no state option is provided', () => {
    const store = defineStore('some', {})()

    expect(store.$state).toEqual({})
  })
})
