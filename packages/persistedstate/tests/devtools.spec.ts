import { devtoolsPlugin } from '@pinia-react/devtools'
import { createPinia, defineStore } from 'pinia-react'
import { createPersistedState } from '../src'
import { memoryStorage } from './helpers'

afterEach(() => {
  Reflect.deleteProperty(window, '__REDUX_DEVTOOLS_EXTENSION__')
})

it.each(['persist-first', 'devtools-first'])(
  'cooperates with DevTools in %s order, persisting real restores without echo loops',
  (order) => {
    let dispatch!: (message: unknown) => void
    const connection = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: vi.fn((listener: typeof dispatch) => {
        dispatch = listener
      })
    }
    Object.defineProperty(window, '__REDUX_DEVTOOLS_EXTENSION__', {
      value: { connect: vi.fn(() => connection) },
      configurable: true
    })
    const storage = memoryStorage({ tools: '{"count":4}' })
    const persist = createPersistedState({ storage })
    const tools = devtoolsPlugin()
    const pinia = createPinia()
    const events = vi.fn()
    pinia.onMutation(events)
    if (order === 'persist-first') pinia.use(persist).use(tools)
    else pinia.use(tools).use(persist)
    const store = defineStore('tools', {
      state: () => ({ count: 0 }),
      devtools: { enabled: true },
      persist: true
    }).getStore()
    expect(store.count).toBe(4)
    expect(storage.setItem).not.toHaveBeenCalled()
    if (order === 'devtools-first')
      expect(connection.send).toHaveBeenCalledExactlyOnceWith(
        { type: '@restore', payload: expect.any(Array) },
        { count: 4 }
      )
    else expect(connection.init).toHaveBeenCalledWith({ count: 4 })
    connection.send.mockClear()
    dispatch({ type: 'DISPATCH', payload: { type: 'JUMP_TO_STATE' }, state: '{"count":9}' })
    expect(store.count).toBe(9)
    expect(storage.values.get('tools')).toBe('{"count":9}')
    expect(connection.send).not.toHaveBeenCalled()
    expect(events.mock.calls.at(-1)?.[0].meta.origin).toBe('@pinia-react/devtools')
    dispatch({ type: 'DISPATCH', payload: { type: 'RESET' } })
    expect(store.count).toBe(0)
    expect(storage.values.get('tools')).toBe('{"count":0}')
    expect(connection.send).not.toHaveBeenCalled()
    store.$patch({ count: 7 })
    expect(connection.send).toHaveBeenCalledOnce()
    expect(storage.values.get('tools')).toBe('{"count":7}')
    connection.send.mockClear()
    storage.values.set('tools', '{"count":8}')
    const writes = storage.setItem.mock.calls.length
    store.$hydrate?.()
    expect(store.count).toBe(8)
    expect(storage.setItem).toHaveBeenCalledTimes(writes)
    expect(connection.send).toHaveBeenCalledExactlyOnceWith(
      { type: '@restore', payload: expect.any(Array) },
      { count: 8 }
    )
    store.$reset()
    expect(storage.values.get('tools')).toBe('{"count":0}')
  }
)
