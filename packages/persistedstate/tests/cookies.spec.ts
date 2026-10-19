/** biome-ignore-all lint/suspicious/noDocumentCookie: Exercise synchronous browser Cookie persistence and browser/server divergence. */
import { createPinia, defineStore, disposePinia } from 'pinia-react'
import { createCookiePersistedState, readCookieSnapshot } from '../src/next'

beforeEach(() => {
  for (const item of document.cookie.split(';')) document.cookie = `${item.split('=')[0].trim()}=; Max-Age=0; Path=/`
})

it('selects only allowlisted final keys and does not expose unrelated request cookies', () => {
  const get = vi.fn((name: string) => ({ value: name === 'app%3Asettings' ? '{"theme":"dark"}' : 'private' }))
  expect(readCookieSnapshot({ get }, ['app:settings'])).toEqual({ 'app:settings': '{"theme":"dark"}' })
  expect(get).toHaveBeenCalledExactlyOnceWith('app%3Asettings')
})

it('restores the request snapshot rather than a newer browser cookie and saves only later commits', () => {
  document.cookie = 'app%3Asettings=%7B%22theme%22%3A%22newer%22%7D; Path=/'
  const write = vi.spyOn(Document.prototype, 'cookie', 'set')
  createPinia().use(
    createCookiePersistedState({ cookies: { 'app:settings': '{"theme":"dark"}' }, key: (key) => `app:${key}` })
  )
  const store = defineStore('settings', {
    state: () => ({ theme: 'light', temporary: true }),
    getters: { label: (state) => state.theme.toUpperCase() },
    persist: { pick: ['theme'] }
  }).getStore()
  expect(store.theme).toBe('dark')
  expect(store.label).toBe('DARK')
  expect(write).not.toHaveBeenCalled()
  store.$patch({ theme: 'blue' })
  expect(document.cookie).toContain('app%3Asettings=%7B%22theme%22%3A%22blue%22%7D')
  expect(document.cookie).not.toContain('temporary')
  document.cookie = 'app%3Asettings=%7B%22theme%22%3A%22green%22%7D; Path=/'
  store.$hydrate?.()
  expect(store.theme).toBe('green')
  write.mockRestore()
})

it('captures the snapshot by value and restores stores created later from the request, not the browser', () => {
  const cookies = { lazy: '{"count":4}' }
  const plugin = createCookiePersistedState({ cookies })
  cookies.lazy = '{"count":99}'
  document.cookie = 'lazy=%7B%22count%22%3A88%7D; Path=/'
  createPinia().use(plugin)
  const store = defineStore('lazy', { state: () => ({ count: 0 }), persist: true }).getStore()
  expect(store.count).toBe(4)
})

it('combines filtering, serializers, global keys and ordered strategies, without initial write-back', () => {
  const order: string[] = []
  const serialize = vi.fn(JSON.stringify)
  createPinia().use(
    createCookiePersistedState({
      cookies: { 'app:first': '{"count":3,"nested":{"keep":"yes","temporary":"old"}}', 'app:second': '{"count":7}' },
      key: (key) => `app:${key}`,
      serializer: { serialize, deserialize: JSON.parse },
      beforeHydrate: ({ store }) => {
        order.push(`before:${store.count}`)
      },
      afterHydrate: ({ store }) => {
        order.push(`after:${store.count}`)
      }
    })
  )
  const store = defineStore('orderedCookies', {
    state: () => ({ count: 0, nested: { keep: 'default', temporary: 'new' } }),
    persist: [
      { key: 'first', pick: ['count', 'nested'], omit: ['nested.temporary'] },
      { key: 'second', pick: ['count'] }
    ]
  }).getStore()
  expect(order).toEqual(['before:0', 'after:3', 'before:3', 'after:7'])
  expect(store.$state).toEqual({ count: 7, nested: { keep: 'yes', temporary: 'new' } })
  expect(serialize).not.toHaveBeenCalled()
  store.$persist?.()
  expect(serialize.mock.calls.map((call) => call[0])).toEqual([{ count: 7, nested: { keep: 'yes' } }, { count: 7 }])
})

it('supports auto and opt-out and ignores browser data when the request key was missing', () => {
  document.cookie = 'enabled=%7B%22count%22%3A99%7D; Path=/'
  createPinia().use(createCookiePersistedState({ cookies: { enabled: null }, auto: true }))
  const enabled = defineStore('enabled', { state: () => ({ count: 1 }) }).getStore()
  const disabled = defineStore('disabled', { state: () => ({ count: 2 }), persist: false }).getStore()
  expect(enabled.count).toBe(1)
  expect(disabled.$hydrate).toBeUndefined()
})

it('handles malformed encoding, invalid payloads and forbidden keys through normal strategy errors', () => {
  const cookies = readCookieSnapshot(
    { get: (name) => ({ value: name === 'bad' ? '%XX' : '{"__proto__":{"polluted":true}}' }) },
    ['bad', 'unsafe']
  )
  const onHydrateError = vi.fn()
  createPinia().use(createCookiePersistedState({ cookies, onHydrateError }))
  const store = defineStore('invalidCookies', {
    state: () => ({ count: 1 }),
    persist: [{ key: 'bad' }, { key: 'unsafe' }]
  }).getStore()
  expect(store.count).toBe(1)
  expect(onHydrateError).toHaveBeenCalledTimes(2)
  expect({}).not.toHaveProperty('polluted')
  store.$patch({ count: 2 })
  expect(document.cookie).toContain('bad=%7B%22count%22%3A2%7D')
})

it('rejects per-strategy storage without reading it, while other strategies still work', () => {
  const getItem = vi.fn(() => '{"count":99}')
  const setItem = vi.fn()
  const onHydrateError = vi.fn()
  const onPersistError = vi.fn()
  createPinia().use(createCookiePersistedState({ cookies: { good: '{"count":3}' }, onHydrateError, onPersistError }))
  const store = defineStore('wrongStorage', {
    state: () => ({ count: 0 }),
    persist: [{ storage: { getItem, setItem } }, { key: 'good' }]
  }).getStore()
  expect(store.count).toBe(3)
  expect(getItem).not.toHaveBeenCalled()
  expect(onHydrateError).toHaveBeenCalledOnce()
  store.$patch({ count: 4 })
  expect(setItem).not.toHaveBeenCalled()
  expect(onPersistError).toHaveBeenCalledOnce()
  expect(document.cookie).toContain('good=%7B%22count%22%3A4%7D')
})

it('URI-encodes names and Unicode values and preserves cookie attributes', () => {
  const write = vi.spyOn(Document.prototype, 'cookie', 'set')
  createPinia().use(
    createCookiePersistedState({
      cookies: {},
      cookieOptions: { path: '/preferences', maxAge: 3600, sameSite: 'strict', secure: true }
    })
  )
  const store = defineStore('偏好:settings', { state: () => ({ text: '中文; = %' }), persist: true }).getStore()
  store.$persist?.()
  expect(write).toHaveBeenCalledExactlyOnceWith(
    `${encodeURIComponent('偏好:settings')}=${encodeURIComponent('{"text":"中文; = %"}')}; Path=/preferences; SameSite=strict; Max-Age=3600; Secure`
  )
  write.mockRestore()
})

it.each([
  { path: '/; injected=value' },
  { path: 'relative' },
  { domain: 'bad;domain' },
  { maxAge: -1 },
  { maxAge: Number.NaN },
  { maxAge: 1.5 },
  { sameSite: 'none' as const, secure: false }
])('reports invalid cookie attributes %j without interrupting later business commits', (cookieOptions) => {
  const onPersistError = vi.fn()
  createPinia().use(createCookiePersistedState({ cookies: {}, cookieOptions, onPersistError }))
  const store = defineStore('attributes', { state: () => ({ count: 0 }), persist: true }).getStore()
  store.$patch({ count: 1 })
  store.$patch({ count: 2 })
  expect(store.count).toBe(2)
  expect(onPersistError).toHaveBeenCalledTimes(2)
})

it.each([
  ['__Host-preferences', { secure: false }],
  ['__Host-preferences', { secure: true, path: '/other' }],
  ['__Host-preferences', { secure: true, domain: 'example.com' }],
  ['__Secure-preferences', { secure: false }]
] as const)('checks prefix constraints for %s', (key, cookieOptions) => {
  const onPersistError = vi.fn()
  createPinia().use(createCookiePersistedState({ cookies: {}, cookieOptions, onPersistError }))
  const store = defineStore('prefix', { state: () => ({ count: 0 }), persist: { key } }).getStore()
  store.$persist?.()
  expect(onPersistError).toHaveBeenCalledOnce()
})

it('reports oversized writes and allows a later smaller write', () => {
  const onPersistError = vi.fn()
  createPinia().use(createCookiePersistedState({ cookies: {}, onPersistError }))
  const store = defineStore('large', { state: () => ({ text: '' }), persist: true }).getStore()
  store.$patch({ text: '中'.repeat(1000) })
  expect(onPersistError).toHaveBeenCalledOnce()
  expect(document.cookie).not.toContain('large=')
  store.$patch({ text: 'ok' })
  expect(document.cookie).toContain('large=%7B%22text%22%3A%22ok%22%7D')
})

it('isolates document.cookie getter/setter failures and throwing error handlers', () => {
  const onHydrateError = vi.fn(() => {
    throw new Error('reporter')
  })
  const onPersistError = vi.fn(() => {
    throw new Error('reporter')
  })
  createPinia().use(createCookiePersistedState({ cookies: { blocked: '{"count":2}' }, onHydrateError, onPersistError }))
  const store = defineStore('blocked', { state: () => ({ count: 0 }), persist: true }).getStore()
  const get = vi.spyOn(Document.prototype, 'cookie', 'get').mockImplementation(() => {
    throw new Error('blocked')
  })
  store.$hydrate?.()
  expect(onHydrateError).toHaveBeenCalledOnce()
  get.mockRestore()
  const set = vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {
    throw new Error('blocked')
  })
  store.$patch({ count: 3 })
  expect(onPersistError).toHaveBeenCalledOnce()
  expect(store.count).toBe(3)
  set.mockRestore()
})

afterEach(() => vi.restoreAllMocks())

it('does not decode already-decoded Next.js values twice', () => {
  const value = JSON.stringify({ text: 'literal %20 and %25 中文' })
  expect(readCookieSnapshot({ get: () => ({ value }) }, ['settings'])).toEqual({ settings: value })
})

it('rejects empty Cookie keys during restore and persistence', () => {
  const onHydrateError = vi.fn()
  const onPersistError = vi.fn()
  createPinia().use(createCookiePersistedState({ cookies: { '': '{"count":9}' }, onHydrateError, onPersistError }))
  const store = defineStore('emptyCookie', { state: () => ({ count: 0 }), persist: { key: '' } }).getStore()
  expect(store.count).toBe(0)
  expect(onHydrateError).toHaveBeenCalledOnce()
  store.$patch({ count: 1 })
  expect(onPersistError).toHaveBeenCalledOnce()
})

it('retains cookies and releases writers when the owning instance is disposed', () => {
  const pinia = createPinia().use(createCookiePersistedState({ cookies: {} }))
  const store = defineStore('cookie-lifetime', { state: () => ({ count: 1 }), persist: true }).getStore(pinia)
  const persist = store.$persist!
  const hydrate = store.$hydrate!
  store.$persist?.()
  const previous = document.cookie
  disposePinia(pinia)
  expect(() => persist()).toThrow(/disposed/)
  expect(() => hydrate()).toThrow(/disposed/)
  expect(document.cookie).toBe(previous)
})
