import { createPinia, defineStore, disposePinia, onStoreDebug } from '../src'

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

it('accepts the published business $pinia state across every mutation path', async () => {
  const pinia = createPinia()
  const events = vi.fn()
  pinia.onMutation(events)
  let restore!: (state: { $pinia: string }) => void
  pinia.use(({ restoreState }) => {
    restore = restoreState
  })
  const store = defineStore('business-state', {
    state: () => ({ $pinia: 'initial' }),
    getters: {
      label(): string {
        return this.$pinia
      }
    },
    actions: {
      async rename() {
        this.$pinia = 'before'
        await Promise.resolve()
        this.$pinia = 'after'
      }
    }
  }).getStore(pinia)
  expect(store.$pinia).toBe('initial')
  expect(store.label).toBe('initial')
  await store.rename()
  expect(store.label).toBe('after')
  store.$patch({ $pinia: 'patch' })
  expect(store.$pinia).toBe('patch')
  store.$reset()
  expect(store.$pinia).toBe('initial')
  restore({ $pinia: 'restored' })
  expect(store.label).toBe('restored')
  expect(pinia.state['business-state']).toEqual({ $pinia: 'restored' })
  expect(events).toHaveBeenCalledTimes(5)
  expect(() => Reflect.set(store, '$pinia', 'outside')).toThrow(TypeError)
})

it('accepts the published business $pinia getter, action and plugin extension', () => {
  const pinia = createPinia()
  const getter = defineStore('business-getter', {
    state: () => ({ count: 2 }),
    getters: { $pinia: (state) => state.count * 2 }
  }).getStore(pinia)
  expect(getter.$pinia).toBe(4)
  const action = defineStore('business-action', {
    state: () => ({ count: 0 }),
    actions: {
      $pinia() {
        this.count++
      }
    }
  }).getStore(pinia)
  action.$pinia()
  expect(action.count).toBe(1)
  const extended = createPinia().use(() => ({ $pinia: 'plugin' }))
  const plugin = defineStore('business-plugin', { state: () => ({}) }).getStore(extended)
  expect(Reflect.get(plugin, '$pinia')).toBe('plugin')
})

it('keeps duplicate-ID references usable without corrupting the replacement state', async () => {
  const pinia = createPinia()
  const cleanup = vi.fn()
  pinia.use(({ onDispose }) => {
    onDispose?.(cleanup)
  })
  let resume!: () => void
  const gate = new Promise<void>((resolve) => {
    resume = resolve
  })
  const original = defineStore('duplicate-compatible', {
    state: () => ({ count: 1 }),
    actions: {
      increment() {
        this.count++
      },
      async later() {
        await gate
        this.count++
      }
    }
  })
  const old = original.getStore(pinia)
  const pending = old.later()
  const fresh = defineStore('duplicate-compatible', { state: () => ({ count: 10 }) }).getStore(pinia)
  expect(old.count).toBe(1)
  old.increment()
  expect(old.count).toBe(2)
  old.$patch({ count: 9 })
  resume()
  await pending
  expect(old.count).toBe(10)
  old.$reset()
  expect(old.count).toBe(1)
  expect(fresh.count).toBe(10)
  expect(pinia.state['duplicate-compatible']).toBe(pinia._scopes.get('duplicate-compatible')!.currentState)
  expect(pinia.state['duplicate-compatible']).toEqual({ count: 10 })
  expect(cleanup).not.toHaveBeenCalled()
  disposePinia(pinia)
  expect(cleanup).toHaveBeenCalledTimes(2)
  expect(() => old.count).toThrow(/disposed/)
  expect(() => fresh.count).toThrow(/disposed/)
})

it('does not register retired Getters or publish retired mutations into the current graph', () => {
  const pinia = createPinia()
  const source = defineStore('retired-source', { state: () => ({ count: 1 }) })
  const original = defineStore('retired-derived', {
    state: () => ({ count: 1 }),
    getters: {
      total(): number {
        return source.getStore(pinia).count + this.count
      }
    }
  }).getStore(pinia)
  expect(original.total).toBe(2)
  const currentGetter = vi.fn((state: { count: number }) => state.count * 2)
  const replacement = defineStore('retired-derived', {
    state: () => ({ count: 10 }),
    getters: { total: currentGetter }
  }).getStore(pinia)
  expect(replacement.total).toBe(20)
  original.$patch({ count: 2 })
  expect(original.total).toBe(3)
  expect(pinia._scopes.get('retired-source')!.subscribers.has('retired-derived')).toBe(false)
  source.getStore(pinia).$patch({ count: 3 })
  expect(original.total).toBe(5)
  expect(replacement.total).toBe(20)
  expect(currentGetter).toHaveBeenCalledOnce()
  const debug = vi.fn()
  onStoreDebug(pinia, debug)
  original.$patch({ count: 4 })
  expect(debug).not.toHaveBeenCalled()
  expect(pinia.state['retired-derived']).toEqual({ count: 10 })
  disposePinia(pinia)
})

it('closes active and retired scopes before cleanup, exactly once', () => {
  const pinia = createPinia()
  const scopes: import('../src/types').StoreScope[] = []
  const cleanup = vi.fn(() => {
    for (const scope of scopes) {
      expect(scope.listeners.size + scope.mutationListeners.size + scope.getterResultCache.size).toBe(0)
      expect(scope.currentState).toEqual({})
    }
  })
  pinia.use(({ onDispose }) => {
    onDispose?.(cleanup)
  })
  const old = defineStore('retired-cleanup', {
    state: () => ({ count: 1 }),
    getters: { total: (s) => s.count * 2 }
  }).getStore(pinia)
  old.$subscribe(vi.fn())
  expect(old.total).toBe(2)
  scopes.push(pinia._scopes.get('retired-cleanup')!)
  defineStore('retired-cleanup', { state: () => ({ count: 10 }) }).getStore(pinia)
  scopes.push(pinia._scopes.get('retired-cleanup')!)
  disposePinia(pinia)
  disposePinia(pinia)
  expect(cleanup).toHaveBeenCalledTimes(2)
})

it('does not delete the current definition when a superseded installation fails', () => {
  const pinia = createPinia()
  const replacement = defineStore('reentrant-definition', { state: () => ({ count: 10 }) })
  const original = defineStore('reentrant-definition', { state: () => ({ count: 1 }) })
  let initializing = true
  let survivor!: ReturnType<typeof original.getStore>
  pinia.use(() => {
    if (!initializing) return
    initializing = false
    replacement.getStore(pinia)
    survivor = original.getStore(pinia)
    survivor.$patch({ count: 7 })
    throw new Error('superseded install failed')
  })
  expect(() => original.getStore(pinia)).toThrow('superseded install failed')
  expect(original.getStore(pinia)).toBe(survivor)
  expect(survivor.count).toBe(7)
  expect(pinia.state['reentrant-definition']).toEqual({ count: 7 })
  disposePinia(pinia)
})
