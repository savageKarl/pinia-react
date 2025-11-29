import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from '../src'

const mockDevTools = {
  connect: vi.fn(),
  init: vi.fn(),
  subscribe: vi.fn(),
  send: vi.fn()
}

describe('Redux DevTools Integration', () => {
  let devToolsSubscriber: ((message: any) => void) | undefined

  beforeAll(() => {
    ;(window as any).__REDUX_DEVTOOLS_EXTENSION__ = mockDevTools
  })

  afterAll(() => {
    delete (window as any).__REDUX_DEVTOOLS_EXTENSION__
  })

  beforeEach(() => {
    vi.clearAllMocks()
    devToolsSubscriber = undefined

    mockDevTools.connect.mockReturnValue({
      init: mockDevTools.init,
      subscribe: (cb: any) => {
        devToolsSubscriber = cb
        mockDevTools.subscribe(cb)
      },
      send: mockDevTools.send
    })

    setActivePinia(createPinia())
  })

  const { useStore } = defineStore('main', {
    state: () => ({ count: 0, name: 'Alice' }),
    actions: {
      increment() {
        this.count++
      }
    }
  })

  test('should initialize devtools on store creation', () => {
    renderHook(() => useStore())
    expect(mockDevTools.connect).toHaveBeenCalledWith({ name: 'main' })
    expect(mockDevTools.init).toHaveBeenCalledWith({ count: 0, name: 'Alice' })
  })

  test('should send updates to devtools on mutations', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.increment()
    })

    expect(mockDevTools.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'increment' }), {
      count: 1,
      name: 'Alice'
    })
  })

  test('should handle JUMP_TO_STATE (Time Travel)', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.increment()
    })

    act(() => {
      if (devToolsSubscriber) {
        devToolsSubscriber({
          type: 'DISPATCH',
          payload: { type: 'JUMP_TO_STATE' },
          state: JSON.stringify({ count: 0, name: 'Alice' })
        })
      }
    })

    expect(result.current.count).toBe(0)
    expect(mockDevTools.send).toHaveBeenCalledTimes(1)
  })

  test('should handle RESET', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.$patch((state) => {
        state.count = 10
      })
    })

    act(() => {
      if (devToolsSubscriber) {
        devToolsSubscriber({
          type: 'DISPATCH',
          payload: { type: 'RESET' }
        })
      }
    })

    expect(result.current.count).toBe(0)
    expect(mockDevTools.init).toHaveBeenCalledTimes(2)
  })

  test('should handle ROLLBACK', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.increment()
    })

    act(() => {
      if (devToolsSubscriber) {
        devToolsSubscriber({
          type: 'DISPATCH',
          payload: { type: 'ROLLBACK' },
          state: { count: 0, name: 'Alice' }
        })
      }
    })

    expect(result.current.count).toBe(0)
  })
})
