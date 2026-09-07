import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore, setActivePinia } from 'pinia-react'
import { devtoolsPlugin } from '../src'

const extension = {
  connect: vi.fn()
}

describe('@pinia-react/devtools', () => {
  let subscriber: ((message: any) => void) | undefined
  let connection: {
    init: ReturnType<typeof vi.fn>
    send: ReturnType<typeof vi.fn>
    subscribe: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    subscriber = undefined
    connection = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: vi.fn((callback) => {
        subscriber = callback
      })
    }
    extension.connect.mockReturnValue(connection)
    ;(window as any).__REDUX_DEVTOOLS_EXTENSION__ = extension
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete (window as any).__REDUX_DEVTOOLS_EXTENSION__
  })

  function setup(options: { enabled?: true; name?: string; trace?: boolean } = { enabled: true }) {
    const pinia = createPinia().use(devtoolsPlugin({ name: 'Application' }))
    setActivePinia(pinia)
    return defineStore('counter', {
      state: () => ({ count: 0 }),
      actions: {
        add(amount: number) {
          this.count += amount
        }
      },
      ...(options.enabled ? { devtools: options as { enabled: true; name?: string; trace?: boolean } } : {})
    })
  }

  test('connects only opted-in stores and initializes their state', () => {
    const { useStore } = setup({ enabled: true, name: 'Counter', trace: true })
    renderHook(() => useStore())

    expect(extension.connect).toHaveBeenCalledWith({ name: 'Application: Counter', trace: true })
    expect(connection.init).toHaveBeenCalledWith({ count: 0 })
  })

  test('does not connect stores without the devtools option', () => {
    const { useStore } = setup({})
    renderHook(() => useStore())

    expect(extension.connect).not.toHaveBeenCalled()
  })

  test('sends action and patch mutations with useful metadata', () => {
    const { useStore } = setup()
    const { result } = renderHook(() => useStore())

    act(() => result.current.add(2))
    act(() =>
      result.current.$patch((state) => {
        state.count = 3
      })
    )

    expect(connection.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'add', payload: expect.objectContaining({ args: [2] }) }),
      { count: 2 }
    )
    expect(connection.send).toHaveBeenNthCalledWith(2, { type: '@patch', payload: expect.any(Array) }, { count: 3 })
  })

  test('restores time-travel state through the core without echoing it back', () => {
    const { useStore } = setup()
    const { result } = renderHook(() => useStore())

    act(() => result.current.add(2))
    connection.send.mockClear()

    act(() =>
      subscriber?.({
        type: 'DISPATCH',
        payload: { type: 'JUMP_TO_STATE' },
        state: JSON.stringify({ count: 9 })
      })
    )

    expect(result.current.count).toBe(9)
    expect(connection.send).not.toHaveBeenCalled()
  })

  test('handles RESET and IMPORT_STATE', () => {
    const { useStore } = setup()
    const { result } = renderHook(() => useStore())

    act(() => result.current.add(2))
    act(() => subscriber?.({ type: 'DISPATCH', payload: { type: 'RESET' } }))
    expect(result.current.count).toBe(0)

    act(() =>
      subscriber?.({
        type: 'DISPATCH',
        payload: {
          type: 'IMPORT_STATE',
          nextLiftedState: { computedStates: [{ state: { count: 4 } }] }
        }
      })
    )
    expect(result.current.count).toBe(4)
  })
})
