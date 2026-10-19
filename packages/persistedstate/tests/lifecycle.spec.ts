import { createPinia, defineStore, disposePinia, type MutationEvent, type PiniaPluginContext } from 'pinia-react'
import { createPersistedState } from '../src'
import { memoryStorage } from './helpers'

it('restores through the core with one stable origin, consistent root/getter/observer state', () => {
  const storage = memoryStorage({ counter: '{"count":4}' })
  const events: MutationEvent[] = []
  const pinia = createPinia()
  pinia.onMutation((event) => events.push(event))
  const observer = vi.fn()
  pinia.use(({ store }) => {
    expect(store.double).toBe(0)
    store.$subscribe(observer)
  })
  pinia.use(createPersistedState({ storage }))
  const store = defineStore('counter', {
    state: () => ({ count: 0, retained: true }),
    getters: { double: (state) => state.count * 2 },
    persist: true
  }).getStore()
  expect(store.double).toBe(8)
  expect(pinia.state.counter).toEqual({ count: 4, retained: true })
  expect(events[0].meta).toEqual({ type: 'restore', origin: '@pinia-react/persistedstate' })
  expect(observer).toHaveBeenCalledTimes(1)
  storage.values.set('counter', '{"count":6}')
  store.$hydrate?.()
  expect(events[1].meta).toEqual(events[0].meta)
  expect(store.double).toBe(12)
  expect(storage.setItem).not.toHaveBeenCalled()
})

it('saves real commits: actions, writes after await, both patches and reset, but not reads', async () => {
  const storage = memoryStorage()
  createPinia().use(createPersistedState({ storage }))
  const store = defineStore('commits', {
    state: () => ({ count: 0 }),
    persist: true,
    getters: { double: (s) => s.count * 2 },
    actions: {
      add() {
        this.count++
      },
      async later() {
        this.count++
        await Promise.resolve()
        this.count++
      }
    }
  }).getStore()
  expect(storage.setItem).not.toHaveBeenCalled()
  expect(store.double).toBe(0)
  store.add()
  await store.later()
  store.$patch({ count: 4 })
  store.$patch((draft) => {
    draft.count++
  })
  store.$reset()
  expect(storage.setItem.mock.calls.map(([, value]) => JSON.parse(value).count)).toEqual([1, 2, 3, 4, 5, 0])
  expect(storage.values.get('commits')).toBe('{"count":0}')
})

it('does not save cross-store getter invalidation', () => {
  const storage = memoryStorage()
  createPinia().use(createPersistedState({ storage, auto: true }))
  const { getStore: getSource } = defineStore('source', { state: () => ({ count: 1 }) })
  const source = getSource()
  const derived = defineStore('derived', {
    state: () => ({}),
    getters: { double: () => getSource().count * 2 }
  }).getStore()
  expect(derived.double).toBe(2)
  source.$patch({ count: 3 })
  expect(derived.double).toBe(6)
  expect(storage.setItem.mock.calls.map(([key]) => key)).toEqual(['source'])
})

it('restores every strategy before installing automatic writes, with later overlaps winning', () => {
  const first = memoryStorage({ first: '{"profile":{"name":"first","theme":"dark"},"items":[1]}' })
  const second = memoryStorage({ second: '{"profile":{"name":"second"},"items":[2]}' })
  createPinia().use(createPersistedState())
  const store = defineStore('multi', {
    state: () => ({ profile: { name: '', theme: 'light', retained: true }, items: [0] }),
    persist: [
      { key: 'first', storage: first },
      { key: 'second', storage: second, pick: ['profile.name', 'items'] }
    ]
  }).getStore()
  expect(store.$state).toEqual({ profile: { name: 'second', theme: 'dark', retained: true }, items: [2] })
  expect(first.setItem).not.toHaveBeenCalled()
  expect(second.setItem).not.toHaveBeenCalled()
  expect(JSON.parse(first.values.get('first')!).profile.name).toBe('first')
  store.$patch((draft) => {
    draft.profile.name = 'business'
  })
  expect(JSON.parse(first.values.get('first')!).profile.theme).toBe('dark')
  expect(JSON.parse(second.values.get('second')!)).toEqual({ profile: { name: 'business' }, items: [2] })
})

it('reads and writes same-key strategies in declaration order without an initialization write', () => {
  const storage = memoryStorage({ same: '{"count":5,"other":6}' })
  createPinia().use(createPersistedState({ storage }))
  const store = defineStore('same', {
    state: () => ({ count: 0, other: 0 }),
    persist: [{ pick: ['count'] }, { pick: ['other'] }]
  }).getStore()
  expect(store.$state).toEqual({ count: 5, other: 6 })
  expect(storage.getItem).toHaveBeenCalledTimes(2)
  expect(storage.setItem).not.toHaveBeenCalled()
  store.$persist?.()
  expect(storage.setItem.mock.calls).toEqual([
    ['same', '{"count":5}'],
    ['same', '{"other":6}']
  ])
  expect(storage.values.get('same')).toBe('{"other":6}')
})

it('filters on both read and write, detaching each serializer input from state and other strategies', () => {
  const storage = memoryStorage({ filter: '{"profile":{"name":"saved","secret":"saved secret"},"items":[8]}' })
  const mutate = vi.fn((state: Record<string, unknown>) => {
    ;(state.profile as { name: string }).name = 'serializer mutation'
    return JSON.stringify(state)
  })
  const serialize = vi.fn(JSON.stringify)
  createPinia().use(createPersistedState({ storage }))
  const store = defineStore('filter', {
    state: () => ({ profile: { name: '', secret: 'keep' }, items: [0] }),
    persist: [
      { pick: ['profile'], omit: ['profile.secret'], serializer: { serialize: mutate, deserialize: JSON.parse } },
      { key: 'second', serializer: { serialize, deserialize: JSON.parse } }
    ]
  }).getStore()
  expect(store.profile).toEqual({ name: 'saved', secret: 'keep' })
  expect(store.items).toEqual([0])
  store.$persist?.()
  expect(store.profile.name).toBe('saved')
  expect(serialize).toHaveBeenCalledWith({ profile: { name: 'saved', secret: 'keep' }, items: [0] })
})

it('isolates memory and guards across Pinia instances but allows an intentionally shared external key', () => {
  const storage = memoryStorage({ shared: '{"count":1}' })
  const plugin = createPersistedState({ storage })
  const definition = defineStore('shared', { state: () => ({ count: 0 }), persist: true })
  const firstPinia = createPinia().use(plugin)
  const first = definition.getStore()
  first.$patch({ count: 2 })
  const secondPinia = createPinia().use(plugin)
  const second = definition.getStore()
  expect(second.count).toBe(2)
  second.$patch({ count: 3 })
  expect(first.count).toBe(2)
  expect(firstPinia.state.shared.count).toBe(2)
  expect(secondPinia.state.shared.count).toBe(3)
})

it('does not create restore mutations for a missing key or mutations for explicit persistence', () => {
  const storage = memoryStorage()
  const events = vi.fn()
  createPinia().use(createPersistedState({ storage })).onMutation(events)
  const store = defineStore('missing', { state: () => ({ count: 1 }), persist: true }).getStore()
  expect(events).not.toHaveBeenCalled()
  store.$persist?.()
  expect(events).not.toHaveBeenCalled()
  expect(storage.setItem).toHaveBeenCalledOnce()
})

it('suppresses its own restore origin even when another plugin uses the controlled restore API', () => {
  const storage = memoryStorage()
  let context!: PiniaPluginContext
  createPinia()
    .use(createPersistedState({ storage }))
    .use((c) => {
      context = c
    })
  const store = defineStore('origin', { state: () => ({ count: 0 }), persist: true }).getStore()
  context.restoreState({ count: 4 }, { origin: '@pinia-react/persistedstate' })
  expect(storage.setItem).not.toHaveBeenCalled()
  context.restoreState({ count: 5 }, { origin: 'other-plugin' })
  expect(store.count).toBe(5)
  expect(storage.setItem).toHaveBeenCalledOnce()
})

it('releases persistence listeners without deleting storage, and rejects captured methods after disposal', () => {
  const storage = memoryStorage({ closed: '{"count":7}' })
  const errors = vi.fn()
  const pinia = createPinia().use(createPersistedState({ storage, onHydrateError: errors, onPersistError: errors }))
  const store = defineStore('closed', { state: () => ({ count: 0 }), persist: true }).getStore(pinia)
  const hydrate = store.$hydrate!
  const persist = store.$persist!
  const scope = pinia._scopes.get('closed')!
  store.$patch({ count: 8 })
  const writes = storage.setItem.mock.calls.length
  disposePinia(pinia)
  expect(scope.mutationListeners.size).toBe(0)
  expect(() => hydrate()).toThrow(/disposed/)
  expect(() => persist()).toThrow(/disposed/)
  expect(storage.setItem).toHaveBeenCalledTimes(writes)
  expect(storage.values.get('closed')).toBe('{"count":8}')
  expect(errors).not.toHaveBeenCalled()
})

it('rolls back failed installs without accumulating writers and preserves their original snapshot', () => {
  const storage = memoryStorage()
  const pinia = createPinia().use(createPersistedState({ storage }))
  pinia._initialStores.retry = { count: 7 }
  let fail = true
  const captures: (() => void)[] = []
  pinia.use(({ store }) => {
    captures.push(store.$persist!)
    if (fail) throw new Error('later plugin')
  })
  const definition = defineStore('retry', { state: () => ({ count: 0 }), persist: true })
  for (let iteration = 0; iteration < 5; iteration++) {
    expect(() => definition.getStore(pinia)).toThrow('later plugin')
    expect(pinia._s.size + pinia._scopes.size).toBe(0)
    expect(pinia._initialStores.retry).toEqual({ count: 7 })
  }
  fail = false
  const store = definition.getStore(pinia)
  for (const persist of captures.slice(0, -1)) expect(() => persist()).toThrow(/disposed/)
  store.$patch({ count: 8 })
  expect(storage.setItem).toHaveBeenCalledOnce()
  disposePinia(pinia)
})

it('does not write after a serializer disposes its own instance or swallow that lifecycle failure', () => {
  const storage = memoryStorage()
  const errors = vi.fn()
  const pinia = createPinia().use(createPersistedState({ storage, onPersistError: errors }))
  const store = defineStore('serializer-close', {
    state: () => ({ count: 0 }),
    persist: {
      serializer: {
        deserialize: JSON.parse,
        serialize: () => {
          disposePinia(pinia)
          return '{}'
        }
      }
    }
  }).getStore(pinia)
  const persist = store.$persist!
  expect(() => persist()).toThrow(/disposed/)
  expect(storage.setItem).not.toHaveBeenCalled()
  expect(errors).not.toHaveBeenCalled()
})

it('preserves the runtime behavior for a legacy core context without onDispose', () => {
  const storage = memoryStorage()
  const pinia = createPinia().use((context) => {
    const { onDispose: _onDispose, ...legacy } = context
    return createPersistedState({ storage })(legacy)
  })
  const store = defineStore('legacy-persist', { state: () => ({ count: 0 }), persist: true }).getStore(pinia)
  store.$patch({ count: 1 })
  expect(storage.setItem).toHaveBeenCalledWith('legacy-persist', '{"count":1}')
})
