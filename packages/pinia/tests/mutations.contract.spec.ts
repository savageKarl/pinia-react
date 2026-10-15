import { createPinia, defineStore, type MutationEvent } from '../src'

describe('Mutation notifications', () => {
  it('initializes root state and registers the store before plugins run', () => {
    const pinia = createPinia()
    pinia.use(({ store, id, pinia: instance }) => {
      expect(instance.state[id]).toEqual({ count: 0 })
      expect(instance._s.get(id)).toBe(store)
    })
    defineStore('initial', { state: () => ({ count: 0 }) }).getStore()
    expect(pinia.state.initial).toEqual({ count: 0 })
  })

  it('forwards the same mutation event to subscriptions and global listeners', () => {
    const pinia = createPinia()
    const events: MutationEvent[] = []
    pinia.onMutation((event) => events.push(event))
    const { getStore } = defineStore('events', { state: () => ({ count: 0 }) })
    const store = getStore()
    const subscriber = vi.fn()
    const stop = store.$subscribe(subscriber)
    store.$patch((draft) => {
      draft.count++
    })
    expect(subscriber).toHaveBeenCalledExactlyOnceWith({ count: 1 }, { count: 0 }, events[0])
    expect(events[0]).toMatchObject({ storeId: 'events', store, meta: { type: 'patch' } })
    stop()
    store.$reset()
    expect(subscriber).toHaveBeenCalledTimes(1)
  })

  it('does not turn cross-store getter invalidation into a user mutation', () => {
    const pinia = createPinia()
    const { getStore: getSource } = defineStore('source', { state: () => ({ count: 1 }) })
    const { getStore: getDerived } = defineStore('derived', {
      state: () => ({}),
      getters: { double: () => getSource().count * 2 }
    })
    const derived = getDerived()
    expect(derived.double).toBe(2)
    const subscriber = vi.fn()
    const events: MutationEvent[] = []
    derived.$subscribe(subscriber)
    pinia.onMutation((event) => events.push(event))
    getSource().$patch((draft) => {
      draft.count++
    })
    expect(derived.double).toBe(4)
    expect(subscriber).not.toHaveBeenCalled()
    expect(events.map((event) => event.storeId)).toEqual(['source'])
  })

  it('preserves restore origin and invalidates getters before notifying observers', () => {
    const pinia = createPinia()
    let restore!: (state: { count: number }) => void
    pinia.use(({ restoreState }) => {
      restore = (state) => restoreState(state, { origin: 'storage' })
    })
    const { getStore } = defineStore('restore', {
      state: () => ({ count: 0 }),
      getters: { double: (state) => state.count * 2 }
    })
    const store = getStore()
    expect(store.double).toBe(0)
    const subscriber = vi.fn((_next, _prev, event) => {
      expect(store.double).toBe(8)
      expect(event.meta).toEqual({ type: 'restore', origin: 'storage' })
    })
    store.$subscribe(subscriber)
    restore({ count: 4 })
    expect(subscriber).toHaveBeenCalledTimes(1)
  })
})
