/** biome-ignore-all lint/suspicious/noDuplicateTestHooks: <> */
import { act, renderHook, waitFor } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Subscriptions', () => {
  // Define the useStore function, consistent with the original code
  const useStoreDefinition = defineStore('main', {
    state: () => ({
      user: 'Eduardo'
    }),
    actions: {
      direct(name: string) {
        this.user = name
      },
      patchObject(user: string) {
        this.$patch({ user })
      },
      patchFn(name: string) {
        this.$patch((state) => {
          state.user = name
        })
      },
      async asyncUpperName() {
        return this.user.toUpperCase()
      },
      upperName() {
        return this.user.toUpperCase()
      },
      throws(e: any) {
        throw e
      },
      async rejects(e: any) {
        throw e
      }
    }
  })

  // Before each test, create a new Pinia instance
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('triggers callback when an action is called', () => {
    const spy = vi.fn()
    const { result } = renderHook(() => useStoreDefinition())

    result.current.$onAction(spy)

    act(() => {
      result.current.direct('Cleiton')
    })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'direct',
        args: ['Cleiton'],
        store: result.current
      })
    )
  })

  it('removes the callback when unsubscribe is called', () => {
    const spy = vi.fn()
    const { result } = renderHook(() => useStoreDefinition())

    const unsubscribe = result.current.$onAction(spy)
    unsubscribe()

    act(() => {
      result.current.direct('Cleiton')
    })

    expect(spy).not.toHaveBeenCalled()
  })

  it('can register multiple onAction listeners', async () => {
    const spy1 = vi.fn()
    const spy2 = vi.fn()
    const { result } = renderHook(() => useStoreDefinition())

    result.current.$onAction(({ after }) => {
      after(spy1)
    })
    result.current.$onAction(({ after }) => {
      after(spy2)
    })

    await act(async () => {
      await expect(result.current.asyncUpperName()).resolves.toBe('EDUARDO')
    })

    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(1)
  })

  it('after callback receives the returned value from the action', async () => {
    const spy = vi.fn()
    const { result } = renderHook(() => useStoreDefinition())

    result.current.$onAction((context) => {
      context.after(spy)
    })

    act(() => {
      expect(result.current.upperName()).toBe('EDUARDO')
    })

    // wait for the after callback to be executed
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith('EDUARDO')
    })
  })

  it('after callback receives the resolved value from an async action', async () => {
    const spy = vi.fn()
    const { result } = renderHook(() => useStoreDefinition())

    result.current.$onAction(({ after }) => {
      after(spy)
    })

    await act(async () => {
      await expect(result.current.asyncUpperName()).resolves.toBe('EDUARDO')
    })

    // after the async action is resolved, the after callback is called
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('EDUARDO')
  })

  it('calls onError when an action throws', () => {
    const spy = vi.fn()
    const { result } = renderHook(() => useStoreDefinition())

    result.current.$onAction(({ onError }) => {
      onError(spy)
    })

    expect(() =>
      act(() => {
        result.current.throws('fail')
      })
    ).toThrow()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('fail')
  })

  it('calls onError when an action is rejected', async () => {
    const spy = vi.fn()
    const { result } = renderHook(() => useStoreDefinition())
    expect.assertions(3)

    result.current.$onAction(({ onError }) => {
      onError(spy)
    })

    // for promises that reject, we can directly await expect(...).rejects
    await expect(result.current.rejects('fail')).rejects.toBe('fail')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('fail')
  })

  it("calling unsubscribe multiple times doesn't affect other listeners", () => {
    const func1 = vi.fn()
    const func2 = vi.fn()
    const { result } = renderHook(() => useStoreDefinition())

    const unsubscribe1 = result.current.$onAction(func1)
    result.current.$onAction(func2)

    unsubscribe1()
    unsubscribe1() // called multiple times

    act(() => {
      result.current.direct('Cleiton')
    })

    expect(func1).not.toHaveBeenCalled()
    expect(func2).toHaveBeenCalledTimes(1)
  })

  describe('multiple store instances', () => {
    const useMultiInstanceStore = defineStore('main', {
      state: () => ({ name: 'Eduardo' }),
      actions: {
        changeName(name: string) {
          this.name = name
        }
      }
    })

    it('multiple subscriptions to the same store instance are triggered', () => {
      // Under the same Pinia instance, calling useStore() multiple times returns the same singleton
      const { result: r1 } = renderHook(() => useMultiInstanceStore())
      const { result: r2 } = renderHook(() => useMultiInstanceStore())

      expect(r1.current).toBe(r2.current) // verify it's the same instance

      const spy1 = vi.fn()
      const spy2 = vi.fn()

      r1.current.$onAction(spy1)
      r2.current.$onAction(spy2)

      expect(spy1).not.toHaveBeenCalled()
      expect(spy2).not.toHaveBeenCalled()

      act(() => {
        r1.current.changeName('Edu')
      })

      expect(spy1).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(1)
    })

    it('subscriptions added within a hook are automatically removed when the hook is unmounted', async () => {
      const spy1 = vi.fn() // subscribe inside the hook
      const spy2 = vi.fn() // subscribe outside the hook

      // Simulate component mounting and subscribe to the action in setup
      const { unmount } = renderHook(() => {
        const storeInHook = useMultiInstanceStore()
        storeInHook.$onAction(spy1)
      })

      // Get the same store instance outside the hook and add another subscription
      const { result } = renderHook(() => useMultiInstanceStore())
      const storeOutsideHook = result.current
      storeOutsideHook.$onAction(spy2)

      expect(spy1).not.toHaveBeenCalled()
      expect(spy2).not.toHaveBeenCalled()

      // first action call
      act(() => {
        storeOutsideHook.changeName('Cleiton')
      })
      expect(spy1).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(1)

      // second action call
      act(() => {
        storeOutsideHook.changeName('other')
      })
      expect(spy1).toHaveBeenCalledTimes(2)
      expect(spy2).toHaveBeenCalledTimes(2)

      // unmount the hook, which should automatically remove the spy1 subscription
      unmount()
      // await nextTick()
      // third action call
      act(() => {
        storeOutsideHook.changeName('again')
      })

      // spy1 is no longer called because it has been removed
      expect(spy1).toHaveBeenCalledTimes(2)
      // spy2 is still active
      expect(spy2).toHaveBeenCalledTimes(3)
    })
  })
})
