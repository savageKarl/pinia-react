import { createPinia, defineStore } from 'pinia-react'
import persistedState, { createPersistedState, type Persist } from '../src'
import { memoryStorage } from './helpers'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

it('exports a default plugin and factory; restores defaults without an initial write', () => {
  localStorage.setItem('preferences', '{"count":4}')
  const write = vi.spyOn(Storage.prototype, 'setItem')
  createPinia().use(persistedState)
  const store = defineStore('preferences', { state: () => ({ count: 0 }), persist: true }).getPreferencesStore()
  expect(store.count).toBe(4)
  expect(write).not.toHaveBeenCalled()
  store.$patch({ count: 5 })
  expect(localStorage.getItem('preferences')).toBe('{"count":5}')
})

it.each([undefined, false] as const)('does not enable %s without auto', (persist) => {
  const storage = memoryStorage()
  createPinia().use(createPersistedState({ storage }))
  const store = defineStore('disabled', { state: () => ({ count: 0 }), persist }).getStore()
  store.$patch({ count: 2 })
  expect(store.$hydrate).toBeUndefined()
  expect(store.$persist).toBeUndefined()
  expect(storage.getItem).not.toHaveBeenCalled()
  expect(storage.setItem).not.toHaveBeenCalled()
})

it('supports auto, explicit opt-out, and initialization-only registration', () => {
  const storage = memoryStorage({ automatic: '{"count":3}' })
  const pinia = createPinia()
  const old = defineStore('old', { state: () => ({ count: 0 }), persist: true }).getStore()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  pinia.use(createPersistedState({ storage, auto: true }))
  expect(warn).toHaveBeenCalledOnce()
  expect(old.$persist).toBeUndefined()
  expect(defineStore('automatic', { state: () => ({ count: 0 }) }).getStore().count).toBe(3)
  const off = defineStore('off', { state: () => ({ count: 0 }), persist: false }).getStore()
  expect(off.$persist).toBeUndefined()
  expect(storage.getItem).toHaveBeenCalledTimes(1)
})

it.each([true, {}, [{}, {}], []] satisfies Persist[])('normalizes configuration %j', (persist) => {
  const storage = memoryStorage()
  createPinia().use(createPersistedState({ storage }))
  const store = defineStore('config', { state: () => ({ count: 0 }), persist }).getStore()
  const size = Array.isArray(persist) ? persist.length : 1
  expect(store.$persist).toBeTypeOf('function')
  expect(store.$hydrate).toBeTypeOf('function')
  expect(storage.getItem).toHaveBeenCalledTimes(size)
  store.$patch({ count: 2 })
  expect(storage.setItem).toHaveBeenCalledTimes(size)
})

it('resolves store keys before global keys, including explicit empty keys', () => {
  const storage = memoryStorage()
  const globalKey = vi.fn((key: string) => `app:${key}`)
  createPinia().use(createPersistedState({ storage, key: globalKey }))
  const storeKey = vi.fn((id: string) => `${id}-custom`)
  defineStore('keys', { state: () => ({}), persist: [{ key: storeKey }, { key: '' }] }).getStore()
  expect(storeKey).toHaveBeenCalledWith('keys')
  expect(globalKey.mock.calls).toEqual([['keys-custom'], ['']])
  expect(storage.getItem.mock.calls).toEqual([['app:keys-custom'], ['app:']])
})

it('applies global defaults with per-strategy overrides and explicit false/empty arrays', () => {
  const globalStorage = memoryStorage()
  const local = memoryStorage()
  const globalHook = vi.fn()
  const localHook = vi.fn()
  const serialize = vi.fn(() => 'custom')
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  createPinia().use(createPersistedState({ storage: globalStorage, debug: true, beforeHydrate: globalHook }))
  const store = defineStore('overrides', {
    state: () => ({ count: 0 }),
    persist: [
      {
        storage: local,
        beforeHydrate: localHook,
        pick: [],
        omit: [],
        serializer: { serialize, deserialize: JSON.parse }
      },
      {
        key: 'failure',
        debug: false,
        storage: {
          getItem() {
            throw Error('blocked')
          },
          setItem() {}
        }
      }
    ]
  }).getStore()
  expect(globalStorage.getItem).not.toHaveBeenCalled()
  expect(globalHook).toHaveBeenCalledTimes(1)
  expect(localHook).toHaveBeenCalledTimes(1)
  expect(error).not.toHaveBeenCalled()
  store.$persist?.()
  expect(serialize).toHaveBeenCalledWith({})
  expect(local.setItem).toHaveBeenCalledWith('overrides', 'custom')
})
