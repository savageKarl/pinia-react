import { createPinia, defineStore, disposePinia } from 'pinia-react'
import { devtoolsPlugin } from '../src'

function extensionFixture(returnStop = true) {
  const messages: ((message: unknown) => void)[] = []
  const stop = vi.fn()
  const connection = {
    init: vi.fn(),
    send: vi.fn(),
    subscribe: vi.fn((listener: (message: unknown) => void) => {
      messages.push(listener)
      return returnStop ? stop : undefined
    }),
    unsubscribe: vi.fn()
  }
  const extension = { connect: vi.fn(() => connection), disconnect: vi.fn() }
  ;(window as any).__REDUX_DEVTOOLS_EXTENSION__ = extension
  return { connection, extension, stop, messages }
}

afterEach(() => {
  delete (window as any).__REDUX_DEVTOOLS_EXTENSION__
})

it.each([true, false])(
  'releases the subscription and this connection only (subscribe returns stop: %s)',
  (returnStop) => {
    const { connection, extension, stop, messages } = extensionFixture(returnStop)
    const pinia = createPinia().use(devtoolsPlugin())
    const store = defineStore('tools', { state: () => ({ count: 0 }), devtools: { enabled: true } }).getStore(pinia)
    store.$patch({ count: 1 })
    expect(connection.send).toHaveBeenCalledOnce()
    disposePinia(pinia)
    disposePinia(pinia)
    expect(stop).toHaveBeenCalledTimes(returnStop ? 1 : 0)
    expect(connection.unsubscribe).toHaveBeenCalledOnce()
    expect(extension.disconnect).not.toHaveBeenCalled()
    const initCount = connection.init.mock.calls.length
    expect(() => messages[0]({ type: 'DISPATCH', payload: { type: 'COMMIT' } })).not.toThrow()
    expect(() => messages[0]({ type: 'DISPATCH', payload: { type: 'RESET' } })).not.toThrow()
    expect(connection.init).toHaveBeenCalledTimes(initCount)
    expect(pinia._m.size).toBe(0)
  }
)

it('disables the connection if init throws without blocking Store creation', () => {
  const { connection } = extensionFixture()
  const failure = new Error('extension init')
  connection.init.mockImplementation(() => {
    throw failure
  })
  const pinia = createPinia().use(devtoolsPlugin())
  const definition = defineStore('tools', { state: () => ({ count: 0 }), devtools: { enabled: true } })
  expect(() => definition.getStore(pinia)).not.toThrow()
  expect(definition.getStore(pinia).count).toBe(0)
  expect(pinia._m.size).toBe(0)
  expect(connection.unsubscribe).toHaveBeenCalledOnce()
  disposePinia(pinia)
  expect(connection.unsubscribe).toHaveBeenCalledOnce()
  expect(connection.subscribe).not.toHaveBeenCalled()
})

it('disables a failed send, preserves later listeners, and releases the connection once', () => {
  const { connection, stop } = extensionFixture()
  const pinia = createPinia().use(devtoolsPlugin())
  const store = defineStore('tools', { state: () => ({ count: 0 }), devtools: { enabled: true } }).getStore(pinia)
  const laterListener = vi.fn()
  pinia.onMutation(laterListener)
  connection.send.mockImplementation(() => {
    throw new Error('extension send')
  })

  expect(() => store.$patch({ count: 1 })).not.toThrow()
  expect(store.count).toBe(1)
  expect(laterListener).toHaveBeenCalledOnce()

  store.$patch({ count: 2 })
  expect(store.count).toBe(2)
  expect(connection.send).toHaveBeenCalledOnce()
  expect(laterListener).toHaveBeenCalledTimes(2)

  disposePinia(pinia)
  expect(stop).toHaveBeenCalledOnce()
  expect(connection.unsubscribe).toHaveBeenCalledOnce()
})

it('keeps Store creation and mutations working when the extension connection fails', () => {
  const { extension } = extensionFixture()
  extension.connect.mockImplementation(() => {
    throw new Error('extension connect')
  })
  const pinia = createPinia().use(devtoolsPlugin())
  const definition = defineStore('tools', { state: () => ({ count: 0 }), devtools: { enabled: true } })

  expect(() => definition.getStore(pinia)).not.toThrow()
  const store = definition.getStore(pinia)
  expect(() => store.$patch({ count: 1 })).not.toThrow()
  expect(store.count).toBe(1)
})

it('disables the integration and releases its connection when subscription fails', () => {
  const { connection, stop } = extensionFixture()
  connection.subscribe.mockImplementation(() => {
    throw new Error('extension subscribe')
  })
  const pinia = createPinia().use(devtoolsPlugin())
  const store = defineStore('tools', { state: () => ({ count: 0 }), devtools: { enabled: true } }).getStore(pinia)
  const laterListener = vi.fn()
  pinia.onMutation(laterListener)

  expect(() => store.$patch({ count: 1 })).not.toThrow()
  expect(store.count).toBe(1)
  expect(laterListener).toHaveBeenCalledOnce()
  expect(connection.send).not.toHaveBeenCalled()
  expect(stop).not.toHaveBeenCalled()
  expect(connection.unsubscribe).toHaveBeenCalledOnce()

  disposePinia(pinia)
  expect(connection.unsubscribe).toHaveBeenCalledOnce()
})

it('continues releasing other resources when subscribe-stop and unsubscribe throw', () => {
  const { connection, stop, messages, extension } = extensionFixture()
  const pinia = createPinia().use(devtoolsPlugin())
  defineStore('tools', { state: () => ({ count: 0 }), devtools: { enabled: true } }).getStore(pinia)
  const first = new Error('stop')
  const second = new Error('unsubscribe')
  stop.mockImplementation(() => {
    messages[0]({ type: 'DISPATCH', payload: { type: 'COMMIT' } })
    throw first
  })
  connection.unsubscribe.mockImplementation(() => {
    throw second
  })
  let error: unknown
  try {
    disposePinia(pinia)
  } catch (caught) {
    error = caught
  }
  expect((error as AggregateError).errors).toEqual([first, second])
  expect(connection.init).toHaveBeenCalledOnce()
  expect(connection.unsubscribe).toHaveBeenCalledOnce()
  expect(extension.disconnect).not.toHaveBeenCalled()
  expect(pinia._m.size).toBe(0)
})

it('ignores reentrant messages even before its own cleanup is reached', () => {
  const { messages, connection } = extensionFixture()
  const pinia = createPinia()
    .use(devtoolsPlugin())
    .use(({ onDispose }) => {
      onDispose?.(() => {
        messages[0]({ type: 'DISPATCH', payload: { type: 'RESET' } })
      })
    })
  defineStore('tools', { state: () => ({ count: 0 }), devtools: { enabled: true } }).getStore(pinia)
  expect(() => disposePinia(pinia)).not.toThrow()
  expect(connection.send).not.toHaveBeenCalled()
})

it('repeatedly rolls back later plugin failures, then reconnects from the original snapshot', () => {
  const { extension, connection, stop, messages } = extensionFixture()
  const pinia = createPinia().use(devtoolsPlugin())
  let fail = true
  pinia.use(() => {
    if (fail) throw new Error('later plugin')
  })
  pinia._initialStores.tools = { count: 7 }
  const definition = defineStore('tools', { state: () => ({ count: 0 }), devtools: { enabled: true } })
  for (let iteration = 0; iteration < 5; iteration++) {
    expect(() => definition.getStore(pinia)).toThrow('later plugin')
    expect(connection.unsubscribe).toHaveBeenCalledTimes(iteration + 1)
    expect(stop).toHaveBeenCalledTimes(iteration + 1)
    expect(pinia._m.size).toBe(0)
    expect(pinia._initialStores.tools).toEqual({ count: 7 })
  }
  fail = false
  const store = definition.getStore(pinia)
  expect(store.count).toBe(7)
  messages[0]({ type: 'DISPATCH', payload: { type: 'RESET' } })
  expect(store.count).toBe(7)
  store.$patch({ count: 8 })
  expect(connection.send).toHaveBeenCalledOnce()
  expect(extension.connect).toHaveBeenCalledTimes(6)
  disposePinia(pinia)
  expect(connection.unsubscribe).toHaveBeenCalledTimes(6)
})

it('balances live connections across many instances without disconnecting survivors', () => {
  let live = 0
  const connections: ReturnType<typeof vi.fn>[] = []
  const extension = {
    connect: vi.fn(() => {
      live++
      const unsubscribe = vi.fn(() => {
        live--
      })
      connections.push(unsubscribe)
      return { init: vi.fn(), send: vi.fn(), subscribe: vi.fn(() => vi.fn()), unsubscribe }
    }),
    disconnect: vi.fn()
  }
  ;(window as any).__REDUX_DEVTOOLS_EXTENSION__ = extension
  const definition = defineStore('tools', { state: () => ({ count: 0 }), devtools: { enabled: true } })
  const survivor = createPinia().use(devtoolsPlugin())
  definition.getStore(survivor)
  for (let iteration = 0; iteration < 20; iteration++) {
    const owner = createPinia().use(devtoolsPlugin())
    definition.getStore(owner)
    expect(live).toBe(2)
    disposePinia(owner)
    expect(live).toBe(1)
  }
  definition.getStore(survivor).$patch({ count: 1 })
  disposePinia(survivor)
  expect(live).toBe(0)
  expect(connections.every((stop) => stop.mock.calls.length === 1)).toBe(true)
  expect(extension.disconnect).not.toHaveBeenCalled()
})

it('keeps the existing behavior with legacy core contexts lacking onDispose', () => {
  const { connection } = extensionFixture()
  const pinia = createPinia()
  pinia.use((context) => {
    const { onDispose: _onDispose, ...legacy } = context
    devtoolsPlugin()(legacy)
  })
  const store = defineStore('legacy', { state: () => ({ count: 0 }), devtools: { enabled: true } }).getStore(pinia)
  store.$patch({ count: 1 })
  expect(connection.send).toHaveBeenCalledOnce()
})

it('releases a subscribe return value even if the extension disposes the owner before returning it', () => {
  const { connection, stop } = extensionFixture()
  const pinia = createPinia().use(devtoolsPlugin())
  connection.subscribe.mockImplementation(() => {
    disposePinia(pinia)
    return stop
  })
  const definition = defineStore('reentrant', { state: () => ({ count: 0 }), devtools: { enabled: true } })
  expect(() => definition.getStore(pinia)).toThrow(/disposed/)
  expect(stop).toHaveBeenCalledOnce()
  expect(connection.unsubscribe).toHaveBeenCalledOnce()
  expect(pinia._m.size).toBe(0)
})
