import { createPinia, defineStore } from 'pinia-react'
import { createPersistedState, type PersistenceOptions } from '../src'
import { memoryStorage } from './helpers'

afterEach(() => vi.restoreAllMocks())

it('runs hooks per strategy in order, including missing keys; runHooks only suppresses hooks', () => {
  const order: string[] = []
  const storage = memoryStorage({ second: '{"count":5}' })
  createPinia().use(createPersistedState({ storage }))
  const store = defineStore('hooks', {
    state: () => ({ count: 0 }),
    persist: ['first', 'second'].map((key) => ({
      key,
      beforeHydrate(context) {
        order.push(`before:${key}:${context.store.count}`)
      },
      afterHydrate(context) {
        order.push(`after:${key}:${context.store.count}`)
      }
    }))
  }).getStore()
  expect(order).toEqual(['before:first:0', 'after:first:0', 'before:second:0', 'after:second:5'])
  order.length = 0
  storage.getItem.mockClear()
  store.$hydrate?.({ runHooks: false })
  expect(order).toEqual([])
  expect(storage.getItem.mock.calls).toEqual([['first'], ['second']])
})

it('pauses the whole manual hydrate round, including hook commits, and rejects nested hydrate re-entry', () => {
  const storage = memoryStorage({ round: '{"count":3}' })
  let reentered = false
  const hook = vi.fn(({ store }) => {
    if (store.$hydrate && !reentered) {
      reentered = true
      store.$hydrate({ runHooks: false })
      store.$patch({ count: 4 })
    }
  })
  createPinia().use(createPersistedState({ storage }))
  const store = defineStore('round', { state: () => ({ count: 0 }), persist: { afterHydrate: hook } }).getStore()
  store.$hydrate?.()
  expect(storage.getItem).toHaveBeenCalledTimes(2)
  expect(storage.setItem).not.toHaveBeenCalled()
  expect(store.count).toBe(4)
  store.$patch({ count: 5 })
  expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('round', '{"count":5}')
})

it('isolates hook mutations during initialization and manual hydration for all strategies', () => {
  const storage = memoryStorage({ first: '{"count":1}', second: '{"count":2}' })
  createPinia().use(createPersistedState({ storage }))
  const store = defineStore('mutating-hooks', {
    state: () => ({ count: 0, touched: 0 }),
    persist: [
      {
        key: 'first',
        beforeHydrate({ store }) {
          store.$patch({ touched: 1 })
        }
      },
      {
        key: 'second',
        afterHydrate({ store }) {
          store.$patch({ touched: 2 })
        }
      }
    ]
  }).getStore()
  store.$hydrate?.()
  expect(store.$state).toEqual({ count: 2, touched: 2 })
  expect(storage.setItem).not.toHaveBeenCalled()
  store.$persist?.()
  expect(storage.setItem).toHaveBeenCalledTimes(2)
})

it.each([
  '',
  'invalid JSON',
  'null',
  '[]',
  '1',
  'true',
  '"string"',
  '{"__proto__":{"polluted":true}}',
  '{"nested":{"constructor":{}}}'
])('isolates invalid saved data: %s', (raw) => {
  const storage = memoryStorage({ invalid: raw, valid: '{"count":7}' })
  const error = vi.fn()
  const after = vi.fn()
  createPinia().use(createPersistedState({ storage, onHydrateError: error }))
  const store = defineStore('invalid', {
    state: () => ({ count: 0, keep: true }),
    persist: [{ afterHydrate: after }, { key: 'valid' }]
  }).getStore()
  expect(store.$state).toEqual({ count: 7, keep: true })
  expect(error).toHaveBeenCalledWith(expect.any(Error), store)
  expect(after).not.toHaveBeenCalled()
  expect(storage.values.get('invalid')).toBe(raw)
  expect(Object.prototype).not.toHaveProperty('polluted')
  store.$patch({ count: 8 })
  expect(storage.setItem).toHaveBeenCalledTimes(2)
})

const hydrationFailures: [string, () => PersistenceOptions][] = [
  [
    'key',
    () => ({
      key() {
        throw Error('key')
      }
    })
  ],
  [
    'storage accessor',
    () => ({
      get storage() {
        throw Error('storage')
      }
    })
  ],
  [
    'read',
    () => ({
      storage: {
        getItem() {
          throw Error('read')
        },
        setItem() {}
      }
    })
  ],
  [
    'deserialize',
    () => ({
      serializer: {
        serialize: JSON.stringify,
        deserialize() {
          throw Error('deserialize')
        }
      }
    })
  ],
  [
    'before hook',
    () => ({
      beforeHydrate() {
        throw Error('before')
      }
    })
  ],
  [
    'after hook',
    () => ({
      afterHydrate() {
        throw Error('after')
      }
    })
  ],
  ['filter', () => ({ pick: ['constructor.bad'] })]
]
it.each(hydrationFailures)(
  'contains %s failures and throwing error callbacks; later strategies and commits continue',
  (_label, make) => {
    const storage = memoryStorage({ errors: '{"count":1}', next: '{"count":9}' })
    const error = vi.fn(() => {
      throw Error('callback')
    })
    const observer = vi.fn()
    const pinia = createPinia().use(createPersistedState({ storage, onHydrateError: error, onPersistError: error }))
    pinia.onMutation(observer)
    const store = defineStore('errors', { state: () => ({ count: 0 }), persist: [make(), { key: 'next' }] }).getStore()
    expect(error).toHaveBeenCalled()
    expect(store.count).toBe(9)
    storage.setItem.mockClear()
    observer.mockClear()
    expect(() => store.$patch({ count: 10 })).not.toThrow()
    expect(observer).toHaveBeenCalledOnce()
    expect(storage.values.get('next')).toBe('{"count":10}')
  }
)

it.each(['write', 'serialize', 'global key'] as const)(
  'recovers from a transient %s error without rolling back committed state',
  (failure) => {
    let failing = true
    const storage = memoryStorage()
    const onError = vi.fn(() => {
      throw Error('callback')
    })
    const write = storage.setItem.getMockImplementation()!
    if (failure === 'write')
      storage.setItem.mockImplementation((key, value) => {
        if (failing) throw Error('write')
        write(key, value)
      })
    createPinia().use(
      createPersistedState({
        storage,
        onPersistError: onError,
        onHydrateError: onError,
        ...(failure === 'global key'
          ? {
              key: (key) => {
                if (failing) throw Error('global key')
                return key
              }
            }
          : {}),
        ...(failure === 'serialize'
          ? {
              serializer: {
                serialize: (state) => {
                  if (failing) throw Error('serialize')
                  return JSON.stringify(state)
                },
                deserialize: JSON.parse
              }
            }
          : {})
      })
    )
    const store = defineStore('retry', { state: () => ({ count: 0 }), persist: true }).getStore()
    const observer = vi.fn()
    store.$subscribe(observer)
    expect(() => store.$patch({ count: 1 })).not.toThrow()
    expect(store.count).toBe(1)
    expect(observer).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalled()
    failing = false
    store.$patch({ count: 2 })
    expect(storage.values.get('retry')).toBe('{"count":2}')
  }
)

it('catches default localStorage property access and retries later without a permanent pause', () => {
  const error = vi.fn()
  const accessor = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw Error('SecurityError')
  })
  createPinia().use(createPersistedState({ onHydrateError: error, onPersistError: error }))
  const store = defineStore('security', { state: () => ({ count: 0 }), persist: true }).getStore()
  store.$patch({ count: 1 })
  expect(error).toHaveBeenCalledTimes(2)
  accessor.mockRestore()
  store.$patch({ count: 2 })
  expect(localStorage.getItem('security')).toBe('{"count":2}')
})

it('runHooks false does not suppress errors; debug never logs payloads or sensitive error messages', () => {
  const storage = memoryStorage({ debug: '{sensitive invalid payload' })
  const error = vi.fn()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  createPinia().use(createPersistedState({ storage, debug: true, onHydrateError: error }))
  const store = defineStore('debug', { state: () => ({}), persist: true }).getStore()
  store.$hydrate?.({ runHooks: false })
  expect(error).toHaveBeenCalledTimes(2)
  expect(log).toHaveBeenCalledTimes(2)
  expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive')
})

it('isolates errors thrown by option callbacks/accessors and debug logging itself', () => {
  createPinia().use(
    createPersistedState({
      storage: {
        getItem() {
          throw 'failure'
        },
        setItem() {
          throw 'failure'
        }
      },
      get onHydrateError() {
        throw Error('callback accessor')
      },
      get onPersistError() {
        throw Error('callback accessor')
      },
      debug: true
    })
  )
  vi.spyOn(console, 'error').mockImplementation(() => {
    throw Error('console')
  })
  const store = defineStore('throwing', { state: () => ({ count: 0 }), persist: true }).getStore()
  expect(() => store.$patch({ count: 1 })).not.toThrow()
  expect(store.count).toBe(1)
})

it('resumes saving after a failed manual round and can hydrate successfully on retry', () => {
  const storage = memoryStorage({ manual: '{"count":1}' })
  const error = vi.fn()
  let fail = false
  createPinia().use(createPersistedState({ storage, onHydrateError: error }))
  const store = defineStore('manual', {
    state: () => ({ count: 0 }),
    persist: {
      afterHydrate() {
        if (fail) throw Error('temporary hook failure')
      }
    }
  }).getStore()
  fail = true
  storage.values.set('manual', '{"count":3}')
  store.$hydrate?.()
  expect(store.count).toBe(3)
  expect(error).toHaveBeenCalledOnce()
  expect(storage.setItem).not.toHaveBeenCalled()
  store.$patch({ count: 4 })
  expect(storage.values.get('manual')).toBe('{"count":4}')
  fail = false
  storage.values.set('manual', '{"count":5}')
  store.$hydrate?.()
  expect(store.count).toBe(5)
  expect(storage.setItem).toHaveBeenCalledOnce()
})

it('reports non-Error thrown values even when they cannot be coerced to strings', () => {
  const thrown = Object.create(null)
  const error = vi.fn()
  createPinia().use(
    createPersistedState({
      storage: {
        getItem() {
          throw thrown
        },
        setItem() {
          throw thrown
        }
      },
      onHydrateError: error,
      onPersistError: error
    })
  )
  const store = defineStore('unknown-error', { state: () => ({ count: 0 }), persist: true }).getStore()
  store.$patch({ count: 1 })
  expect(error).toHaveBeenCalledTimes(2)
  for (const [failure, source] of error.mock.calls) {
    expect(failure).toBeInstanceOf(Error)
    expect(source).toBe(store)
  }
})
