import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

describe('Pinia mutation lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  test('emits action, patch, and reset metadata', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const events: Array<{ type: string; action?: string; args?: unknown[] }> = []
    pinia.onMutation((event) => events.push(event.meta))

    const { useStore } = defineStore('counter', {
      state: () => ({ count: 0 }),
      actions: {
        add(amount: number) {
          this.count += amount
        }
      }
    })
    const { result } = renderHook(() => useStore())

    act(() => result.current.add(2))
    act(() =>
      result.current.$patch((state) => {
        state.count = 3
      })
    )
    act(() => result.current.$reset())

    expect(events).toEqual([{ type: 'action', action: 'add', args: [2] }, { type: 'patch' }, { type: 'reset' }])
  })

  test('plugins can restore a whole state through the core commit path', () => {
    const pinia = createPinia()
    const events: any[] = []
    pinia.onMutation((event) => events.push(event))
    pinia.use(({ restoreState }) => {
      restoreState({ count: 5 }, { origin: 'test-plugin' })
    })
    setActivePinia(pinia)

    const { useStore } = defineStore('counter', {
      state: () => ({ count: 0 }),
      getters: {
        doubled: (state) => {
          return state.count * 2
        }
      }
    })
    const { result } = renderHook(() => useStore())

    expect(result.current.count).toBe(5)
    expect(result.current.doubled).toBe(10)
    expect(events).toHaveLength(1)
    expect(events[0].meta).toEqual({ type: 'restore', origin: 'test-plugin' })
    expect(events[0].patches).toEqual([{ op: 'replace', path: [], value: { count: 5 } }])
  })

  test('mutation listeners can unsubscribe', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const listener = vi.fn()
    const stop = pinia.onMutation(listener)
    stop()

    const { getStore } = defineStore('counter', {
      state: () => ({ count: 0 }),
      actions: {
        increment() {
          this.count++
        }
      }
    })
    getStore().increment()

    expect(listener).not.toHaveBeenCalled()
  })
})
