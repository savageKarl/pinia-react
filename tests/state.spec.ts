import { computed, ref, watch } from '@maoism/runtime-core'
import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const useStore = defineStore('main', {
    state: () => ({
      name: 'Eduardo',
      counter: 0,
      nested: { n: 0 }
    })
  })

  it('can directly access state at the store level', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.name).toBe('Eduardo')
    act(() => {
      result.current.name = 'Ed'
    })
    expect(result.current.name).toBe('Ed')
  })

  it('state is reactive', () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    const upperCased = computed(() => store.name.toUpperCase())
    expect(upperCased.value).toBe('EDUARDO')
    act(() => {
      store.name = 'Ed'
    })
    expect(upperCased.value).toBe('ED')
  })

  it('can be set with patch', () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    act(() => {
      store.$patch({ name: 'a' })
    })
    expect(store.name).toBe('a')
    expect(store.$state.name).toBe('a')
  })

  it('can be set on store', () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    act(() => {
      store.name = 'a'
    })
    expect(store.name).toBe('a')
    expect(store.$state.name).toBe('a')
  })

  it('can be set on store.$state', () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    act(() => {
      store.$state.name = 'a'
    })
    expect(store.name).toBe('a')
    expect(store.$state.name).toBe('a')
  })

  it('can be nested set with patch', () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    act(() => {
      store.$patch({ nested: { n: 3 } })
    })
    expect(store.nested.n).toBe(3)
    expect(store.$state.nested.n).toBe(3)
  })

  it('can be nested set on store', () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    act(() => {
      store.nested.n = 3
    })
    expect(store.nested.n).toBe(3)
    expect(store.$state.nested.n).toBe(3)
  })

  it('can be nested set on store.$state', () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    act(() => {
      store.$state.nested.n = 3
    })
    expect(store.nested.n).toBe(3)
    expect(store.$state.nested.n).toBe(3)
  })

  it('state can be watched', async () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    const spy = vi.fn()
    watch(() => store.name, spy)
    expect(spy).not.toHaveBeenCalled()
    await act(() => {
      store.name = 'Ed'
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('state can be watched when a ref is given', async () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    const spy = vi.fn()
    watch(() => store.name, spy)
    expect(spy).not.toHaveBeenCalled()
    const nameRef = ref('Ed')
    await act(() => {
      // @ts-expect-error
      store.$state.name = nameRef
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('can be given a ref', () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    act(() => {
      // @ts-expect-error
      store.$state.name = ref('Ed')
    })
    expect(store.name).toBe('Ed')
    expect(store.$state.name).toBe('Ed')
    act(() => {
      store.name = 'Other'
    })
    expect(store.name).toBe('Other')
    expect(store.$state.name).toBe('Other')
  })

  it('unwraps refs', () => {
    const name = ref('Eduardo')
    const counter = ref(0)
    const double = computed({
      get: () => counter.value * 2,
      set(val) {
        counter.value = val / 2
      }
    })
    const { result } = renderHook(() => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const useStore = defineStore('main', {
        state: () => ({
          name,
          counter,
          double
        })
      })
      return useStore()
    })
    const store = result.current
    expect(store.name).toBe('Eduardo')
    expect(store.$state.name).toBe('Eduardo')
    act(() => {
      name.value = 'Ed'
    })
    expect(store.name).toBe('Ed')
    expect(store.$state.name).toBe('Ed')
    act(() => {
      store.name = 'Edu'
    })
    expect(store.name).toBe('Edu')
    act(() => {
      store.$patch({ counter: 2 })
    })
    expect(store.counter).toBe(2)
    expect(counter.value).toBe(2)
  })

  it('can reset the state', () => {
    const { result } = renderHook(() => useStore())
    const store = result.current
    act(() => {
      store.name = 'Ed'
      store.nested.n++
      store.$reset()
    })

    expect(store.$state).toEqual({
      counter: 0,
      name: 'Eduardo',
      nested: {
        n: 0
      }
    })
  })

  it('can reset the state of an empty store', () => {
    const { result } = renderHook(() => defineStore('a', {})(createPinia()))
    const store = result.current
    expect(store.$state).toEqual({})
    store.$reset()
    expect(store.$state).toEqual({})
  })
})
