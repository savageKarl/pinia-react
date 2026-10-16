// @vitest-environment node
import { createPinia, defineStore } from 'pinia-react'
import { memoryStorage } from './helpers'

it('imports the module without touching browser globals and defaults to an in-memory no-op', async () => {
  expect(typeof window).toBe('undefined')
  vi.resetModules()
  const { default: persistedState } = await import('../src')
  createPinia().use(persistedState)
  const store = defineStore('server', { state: () => ({ count: 0 }), persist: true }).getStore()
  store.$patch({ count: 1 })
  store.$hydrate?.()
  store.$persist?.()
  expect(store.count).toBe(1)
})

it('supports explicitly supplied synchronous storage without window', async () => {
  const { createPersistedState } = await import('../src')
  const storage = memoryStorage({ explicit: '{"count":4}' })
  createPinia().use(createPersistedState({ storage }))
  const store = defineStore('explicit', { state: () => ({ count: 0 }), persist: true }).getStore()
  expect(store.count).toBe(4)
  store.$patch({ count: 5 })
  expect(storage.values.get('explicit')).toBe('{"count":5}')
})
