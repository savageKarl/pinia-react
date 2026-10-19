import { createPinia, defineStore, type MutationEvent, type PiniaPluginContext } from '../src'

const marker = Symbol('marker')
const error = /symbol.*state|state.*symbol/i
const invalidValues = [
  { name: 'root', create: () => ({ [marker]: 1 }) },
  { name: 'nested', create: () => ({ nested: { [marker]: 1 } }) },
  { name: 'array', create: () => ({ items: Object.assign([1], { [marker]: 1 }) }) },
  { name: 'hidden', create: () => Object.defineProperty({}, marker, { value: 1 }) },
  { name: 'hidden nested', create: () => Object.defineProperty({}, 'hidden', { value: { [marker]: 1 } }) }
]

beforeEach(() => createPinia())
afterEach(() => vi.restoreAllMocks())

it.each(invalidValues)('rejects $name symbol keys before registering defaults or snapshots', ({ create }) => {
  for (const snapshot of [false, true]) {
    const pinia = createPinia()
    const invalid = create()
    if (snapshot) pinia._initialStores.rejected = invalid
    const definition = defineStore('rejected', { state: () => (snapshot ? { count: 0 } : invalid) })
    expect(() => definition.getStore(pinia)).toThrow(error)
    expect(pinia.state).toEqual({})
    expect(pinia._s.size).toBe(0)
    expect(pinia._scopes.size).toBe(0)
    if (snapshot) expect(pinia._initialStores.rejected).toBe(invalid)
  }
})

it('checks defaults even when a serialized snapshot would replace them', () => {
  const pinia = createPinia()
  pinia._initialStores.rejected = { count: 1 }
  const definition = defineStore('rejected', { state: () => ({ count: 0, [marker]: 1 }) })
  expect(() => definition.getStore(pinia)).toThrow(error)
  expect(pinia.state).toEqual({})
})

const mutations = [
  { name: 'action root set', run: (state: object) => Reflect.set(state, marker, 1) },
  { name: 'action nested set', run: (state: { nested: object }) => Reflect.set(state.nested, marker, 1) },
  { name: 'action delete', run: (state: object) => Reflect.deleteProperty(state, marker) },
  { name: 'action defineProperty', run: (state: object) => Object.defineProperty(state, marker, { value: 1 }) },
  { name: 'action array set', run: (state: { items: object[] }) => Reflect.set(state.items, marker, 1) },
  { name: 'action array insert', run: (state: { items: object[] }) => state.items.push({ [marker]: 1 }) },
  {
    name: 'action replace',
    run: (state: { nested: object }) => {
      state.nested = { [marker]: 1 }
    }
  },
  {
    name: 'action descriptor',
    run: (state: object) => Reflect.set(Object.getOwnPropertyDescriptor(state, 'nested')!.value, marker, 1)
  }
]

it.each(mutations)('rejects $name without changing state, caches or notifications', ({ run }) => {
  const pinia = createPinia()
  const events: MutationEvent[] = []
  pinia.onMutation((event) => events.push(event))
  const { getStore } = defineStore('rejected-write', {
    state: () => ({ count: 0, nested: { count: 0 }, items: [] as object[], $pinia: 'business' }),
    getters: { doubled: (state) => state.count * 2 },
    actions: {
      update() {
        run(this)
      },
      increment() {
        this.count++
      }
    }
  })
  const store = getStore()
  const before = pinia.state['rejected-write']
  const listener = vi.fn()
  store.$subscribe(listener)
  expect(store.doubled).toBe(0)
  expect(() => store.update()).toThrow(error)
  expect(pinia.state['rejected-write']).toBe(before)
  expect(store.$state).toEqual({ count: 0, nested: { count: 0 }, items: [], $pinia: 'business' })
  expect(store.doubled).toBe(0)
  expect(events).toHaveLength(0)
  expect(listener).not.toHaveBeenCalled()
  store.increment()
  expect(store.doubled).toBe(2)
  expect(events).toHaveLength(1)
})

it.each(['object', 'function', 'descriptor', 'array', 'hidden replacement'] as const)(
  'rejects symbol keys in a %s patch atomically',
  (form) => {
    const pinia = createPinia()
    const events: MutationEvent[] = []
    pinia.onMutation((event) => events.push(event))
    const { getStore } = defineStore('rejected-patch', {
      state: () => ({ count: 0, nested: { count: 0 }, items: [] as object[] })
    })
    const store = getStore()
    const before = pinia.state['rejected-patch']
    const listener = vi.fn()
    store.$subscribe(listener)
    expect(() => {
      if (form === 'object') store.$patch(Object.defineProperty({ count: 1 }, marker, { value: 1 }))
      else
        store.$patch((draft) => {
          draft.count = 1
          if (form === 'function') Reflect.set(draft.nested, marker, 1)
          else if (form === 'descriptor')
            Reflect.set(Object.getOwnPropertyDescriptor(draft, 'nested')!.value, marker, 1)
          else if (form === 'array') Reflect.set(draft.items, marker, 1)
          else draft.nested = Object.defineProperty({ count: 1 }, marker, { value: 1 })
        })
    }).toThrow(error)
    expect(pinia.state['rejected-patch']).toBe(before)
    expect(store.count).toBe(0)
    expect(events).toHaveLength(0)
    expect(listener).not.toHaveBeenCalled()
  }
)

it.each(invalidValues)('rejects $name symbol keys in reset and plugin restore', ({ create }) => {
  const pinia = createPinia()
  let restore!: PiniaPluginContext['restoreState']
  pinia.use((context) => {
    restore = context.restoreState
  })
  let defaults: object = { count: 0 }
  const { getStore } = defineStore('rejected-restore', { state: () => defaults })
  const store = getStore()
  const listener = vi.fn()
  store.$subscribe(listener)
  const before = pinia.state['rejected-restore']
  defaults = create()
  expect(() => store.$reset()).toThrow(error)
  expect(() => restore(create())).toThrow(error)
  expect(pinia.state['rejected-restore']).toBe(before)
  expect(listener).not.toHaveBeenCalled()
})

it('keeps earlier async Action commits without accepting a later symbol write', async () => {
  const pinia = createPinia()
  const events: MutationEvent[] = []
  pinia.onMutation((event) => events.push(event))
  const { getStore } = defineStore('async-rejection', {
    state: () => ({ count: 0, nested: { count: 0 } }),
    actions: {
      async update() {
        this.count++
        await Promise.resolve()
        Reflect.set(this.nested, marker, 1)
      }
    }
  })
  await expect(getStore().update()).rejects.toThrow(error)
  expect(getStore().count).toBe(1)
  expect(events).toHaveLength(1)
  expect(events[0].patches).toEqual([{ op: 'replace', path: ['count'], value: 1 }])
})

it('cannot inject symbols through public readonly reflection', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { getStore } = defineStore('readonly-symbol-rejection', { state: () => ({ nested: { count: 0 } }) })
  const store = getStore()
  for (const value of [
    store.nested,
    store.$state.nested,
    Object.getOwnPropertyDescriptor(store.$state, 'nested')!.value
  ]) {
    expect(() => Reflect.set(value, marker, 1)).toThrow(TypeError)
    expect(() => Object.defineProperty(value, marker, { value: 1 })).toThrow(TypeError)
  }
  expect(Reflect.ownKeys(store.nested)).toEqual(['count'])
})

it('does not rescan untouched objects on scalar mutations and preserves native array iteration', () => {
  const keys = vi.fn(() => ['count'])
  const nested = new Proxy({ count: 0 }, { ownKeys: keys })
  const { getStore } = defineStore('scalar-fast-path', {
    state: () => ({ count: 0, nested, items: [1, 2], $pinia: 'business' }),
    actions: {
      increment() {
        this.count++
      },
      copy() {
        return [...this.items]
      }
    }
  })
  const store = getStore()
  keys.mockClear()
  store.increment()
  expect(keys).not.toHaveBeenCalled()
  expect([...store.items]).toEqual([1, 2])
  expect(store.copy()).toEqual([1, 2])
  store.$patch({ $pinia: 'still business' })
  expect(store.$pinia).toBe('still business')
})
