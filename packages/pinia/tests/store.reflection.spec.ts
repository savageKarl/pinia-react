import { createPinia, defineStore } from '../src'

beforeEach(() => {
  createPinia()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

it.each(['nested', 'count', 'doubled', 'increment', '$state', '$id', '$patch', '$reset', '$subscribe'] as const)(
  'rejects redefining %s without poisoning the public proxy target',
  (key) => {
    const { getStore } = defineStore('readonly-descriptor', {
      state: () => ({ count: 0, nested: { count: 0 } }),
      getters: { doubled: (state) => state.count * 2 },
      actions: {
        increment() {
          this.count++
        }
      }
    })
    const store = getStore()
    expect(() => Object.defineProperty(store, key, { value: 123 })).toThrow(TypeError)
    expect(store.nested.count).toBe(0)
    expect(store.count).toBe(0)
    expect(store.doubled).toBe(0)
    store.increment()
    expect(store.count).toBe(1)
    expect(store.doubled).toBe(2)
  }
)

it('allows new plugin metadata descriptors and ordinary metadata assignments', () => {
  createPinia().use(({ store }) => {
    Object.defineProperty(store, 'pluginLabel', { value: 'metadata' })
    store.pluginVersion = 1
  })
  const { getStore } = defineStore('metadata-descriptor', { state: () => ({ count: 0 }) })
  const store = getStore()
  expect(Reflect.get(store, 'pluginLabel')).toBe('metadata')
  expect(Reflect.get(store, 'pluginVersion')).toBe(1)
  store.$patch({ count: 1 })
  expect(store.count).toBe(1)
})
