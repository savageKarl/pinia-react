import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import {
  createPinia,
  defineStore,
  disposePinia,
  getActivePinia,
  onStoreDebug,
  type PiniaPluginContext,
  PiniaProvider,
  setActivePinia
} from '../src'

it('rolls back failed plugin listeners and cross-Store edges while retaining the original snapshot', () => {
  const pinia = createPinia()
  const application = vi.fn()
  pinia.onMutation(application)
  const source = defineStore('source', { state: () => ({ count: 1 }) })
  const broken = defineStore('broken', {
    state: () => ({ count: 0 }),
    getters: { value: () => source.getStore(pinia).count }
  })
  const snapshot = { count: 7 }
  pinia._initialStores.broken = snapshot
  const failure = new Error('plugin failed')
  pinia.use(({ id, store, pinia }) => {
    if (id !== 'broken') return
    pinia.onMutation(vi.fn())
    store.$subscribe(vi.fn())
    expect(store.value).toBe(1)
    throw failure
  })
  for (let attempt = 0; attempt < 3; attempt++) {
    expect(() => broken.getStore(pinia)).toThrow(failure)
    expect(pinia._m.size).toBe(1)
    expect(pinia._scopes.get('source')!.subscribers.has('broken')).toBe(false)
    expect(pinia._s.has('broken')).toBe(false)
    expect(pinia._initialStores.broken).toBe(snapshot)
  }
  source.getStore(pinia).$patch({ count: 2 })
  expect(application).toHaveBeenCalledOnce()
})

it('reclaims diagnostic subscriptions from a failed plugin installation', () => {
  const pinia = createPinia()
  const debug = vi.fn()
  pinia.use(({ id, pinia }) => {
    if (id !== 'broken') return
    onStoreDebug(pinia, debug)
    throw new Error('plugin failed')
  })
  const broken = defineStore('broken', { state: () => ({ count: 0 }) })
  for (let attempt = 0; attempt < 3; attempt++) expect(() => broken.getStore(pinia)).toThrow('plugin failed')
  defineStore('healthy', { state: () => ({ count: 0 }) })
    .getStore(pinia)
    .$patch({ count: 1 })
  expect(debug).not.toHaveBeenCalled()
})

it('isolates nested successful installations, existing application registrations and later subscriptions', () => {
  const pinia = createPinia()
  const listener = vi.fn()
  const debug = vi.fn()
  pinia.onMutation(listener)
  onStoreDebug(pinia, debug)
  const healthy = defineStore('healthy', { state: () => ({ count: 0 }) })
  const broken = defineStore('broken', { state: () => ({ count: 0 }) })
  pinia.use(({ id, pinia }) => {
    pinia.onMutation(listener)
    onStoreDebug(pinia, debug)
    if (id === 'broken') {
      healthy.getStore(pinia)
      pinia.onMutation(listener)
      throw new Error('failed parent')
    }
  })
  expect(() => broken.getStore(pinia)).toThrow('failed parent')
  expect(pinia._m.size).toBe(2)
  const later = vi.fn()
  pinia.onMutation(later)
  healthy.getStore(pinia).$patch({ count: 1 })
  expect(listener).toHaveBeenCalledTimes(2)
  expect(debug).toHaveBeenCalledTimes(2)
  expect(later).toHaveBeenCalledOnce()
})

it('disposes all scopes before reverse cleanup, aggregates errors, and is reentrant and idempotent', () => {
  const pinia = createPinia()
  const callbacks: string[] = []
  const firstError = new Error('first cleanup')
  const secondError = new Error('second cleanup')
  let context!: PiniaPluginContext
  pinia.use((ctx) => {
    context = ctx
    const cancelled = ctx.onDispose(() => callbacks.push('cancelled'))
    cancelled()
    cancelled()
    ctx.onDispose(() => {
      callbacks.push(ctx.id + ':first')
      throw firstError
    })
    ctx.onDispose(() => {
      callbacks.push(ctx.id + ':last')
      expect(pinia._s.size).toBe(0)
      expect(pinia._scopes.size).toBe(0)
      expect(() => first.count).toThrow(/disposed/)
      expect(() => second.count).toThrow(/disposed/)
      expect(() => ctx.onDispose(() => {})).toThrow(/disposed/)
      disposePinia(pinia)
      throw secondError
    })
  })
  const first = defineStore('first', { state: () => ({ count: 0 }) }).getStore(pinia)
  const second = defineStore('second', { state: () => ({ count: 0 }) }).getStore(pinia)
  const stop = pinia.onMutation(vi.fn())
  const debugStop = onStoreDebug(pinia, vi.fn())
  let error: unknown
  try {
    disposePinia(pinia)
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(AggregateError)
  expect((error as AggregateError).errors).toEqual([secondError, firstError, secondError, firstError])
  expect(callbacks).toEqual(['second:last', 'second:first', 'first:last', 'first:first'])
  expect(pinia.state).toEqual({})
  expect(pinia._p).toHaveLength(0)
  expect(pinia._m.size).toBe(0)
  expect(() => context.onDispose(() => {})).toThrow(/disposed/)
  expect(() => {
    disposePinia(pinia)
    stop()
    debugStop()
  }).not.toThrow()
})

it('preserves the initialization failure as cause when every cleanup is attempted', () => {
  const pinia = createPinia()
  const failure = new Error('business initialization')
  const cleanupFailure = new Error('cleanup')
  const cleaned = vi.fn()
  let captured!: PiniaPluginContext
  pinia._initialStores.broken = { count: 8 }
  pinia.use((context) => {
    captured = context
    context.onDispose(cleaned)
    context.onDispose(() => {
      throw cleanupFailure
    })
    throw failure
  })
  const definition = defineStore('broken', { state: () => ({ count: 0 }) })
  let error: unknown
  try {
    definition.getStore(pinia)
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(AggregateError)
  expect((error as AggregateError).cause).toBe(failure)
  expect((error as AggregateError).errors).toEqual([failure, cleanupFailure])
  expect(cleaned).toHaveBeenCalledOnce()
  expect(pinia._s.size).toBe(0)
  expect(pinia._scopes.size).toBe(0)
  expect(pinia._initialStores.broken).toEqual({ count: 8 })
  expect(() => captured.restoreState({ count: 20 })).toThrow(/disposed/)
})

it('retries with the original snapshot and rejects reentrant recreation during rollback', () => {
  const pinia = createPinia()
  const definition = defineStore('retry', { state: () => ({ count: 0 }) })
  const snapshot = { count: 7 }
  pinia._initialStores.retry = snapshot
  let fail = true
  pinia.use(({ store, restoreState, onDispose }) => {
    onDispose(() => {
      expect(() => definition.getStore(pinia)).toThrow(/disposed/)
    })
    if (fail) {
      restoreState({ count: 99 })
      throw new Error('retry')
    }
    expect(store.count).toBe(7)
  })
  expect(() => definition.getStore(pinia)).toThrow('retry')
  expect(pinia._initialStores.retry).toBe(snapshot)
  fail = false
  expect(definition.getStore(pinia).count).toBe(7)
  disposePinia(pinia)
})

it('never reactivates disposed instances or changes a different active instance', () => {
  const first = createPinia()
  const second = createPinia()
  disposePinia(first)
  expect(getActivePinia()).toBe(second)
  expect(() => first.use(() => {})).toThrow(/disposed/)
  expect(() => first.onMutation(() => {})).toThrow(/disposed/)
  expect(() => onStoreDebug(first, () => {})).toThrow(/disposed/)
  expect(() => setActivePinia(first)).toThrow(/disposed/)
  const definition = defineStore('late', { state: () => ({ count: 0 }) })
  expect(() => definition.getStore(first)).toThrow(/disposed/)
  disposePinia(second)
  expect(() => getActivePinia()).toThrow(/no active/)
  expect(() => definition.getStore()).toThrow(/no active/)
})

it('invalidates captured operations and nested proxies without notifying after disposal', async () => {
  const pinia = createPinia()
  const mutation = vi.fn()
  pinia.onMutation(mutation)
  let restore!: PiniaPluginContext['restoreState']
  pinia.use((context) => {
    restore = context.restoreState
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let actionState: { count: number } | undefined
  const definition = defineStore('old', {
    state: () => ({ count: 0, nested: { count: 0 }, items: [1] }),
    actions: {
      add() {
        this.count++
      },
      async later() {
        actionState = this.nested
        await gate
        this.nested.count++
      }
    }
  })
  const store = definition.getStore(pinia)
  const nested = store.nested
  const state = store.$state
  const patch = store.$patch
  const reset = store.$reset
  const subscribe = store.$subscribe
  const add = store.add
  const stopped = store.$subscribe(vi.fn())
  const pending = store.later()
  disposePinia(pinia)
  for (const operation of [
    () => store.count,
    () => nested.count,
    () => state.count,
    () => Object.keys(nested),
    () => Reflect.has(store, 'count'),
    () => Reflect.getOwnPropertyDescriptor(state, 'count'),
    () => patch({ count: 1 }),
    () => reset(),
    () => subscribe(() => {}),
    () => add(),
    () => restore({ count: 5 }),
    () => Object.defineProperty(actionState!, 'x', { value: 1 })
  ])
    expect(operation).toThrow(/disposed/)
  stopped()
  release()
  await expect(pending).rejects.toThrow(/disposed/)
  expect(mutation).not.toHaveBeenCalled()
  expect(pinia.state).toEqual({})
})

it('cannot commit when a function patch or state factory disposes its owner', () => {
  const pinia = createPinia()
  const store = defineStore('patch', { state: () => ({ count: 0 }) }).getStore(pinia)
  const mutation = vi.fn()
  pinia.onMutation(mutation)
  expect(() =>
    store.$patch((draft) => {
      disposePinia(pinia)
      draft.count = 1
    })
  ).toThrow(/disposed/)
  expect(pinia.state).toEqual({})
  expect(mutation).not.toHaveBeenCalled()
  const other = createPinia()
  expect(() =>
    defineStore('factory', {
      state: () => {
        disposePinia(other)
        return { count: 0 }
      }
    }).getStore(other)
  ).toThrow(/disposed/)
  expect(other.state).toEqual({})
})

it('does not restore initial snapshots when a plugin disposes its owner during initialization', () => {
  const pinia = createPinia()
  pinia._initialStores.closed = { count: 7 }
  pinia.use(() => {
    disposePinia(pinia)
  })
  expect(() => defineStore('closed', { state: () => ({ count: 0 }) }).getStore(pinia)).toThrow(/disposed/)
  expect(pinia._initialStores).toEqual({})
  expect(pinia._s.size).toBe(0)
})

it('detaches same-ID references, removes both edge directions and invalidates surviving Getter caches', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const pinia = createPinia()
  const upstream = defineStore('upstream', { state: () => ({ count: 1 }) })
  const old = defineStore('same', {
    state: () => ({ count: 1 }),
    getters: { upstream: () => upstream.getStore(pinia).count },
    actions: {
      add() {
        this.count++
      }
    }
  })
  const original = old.getStore(pinia)
  expect(original.upstream).toBe(1)
  const oldScope = pinia._scopes.get('same')!
  const oldAdd = original.add
  const oldPatch = original.$patch
  const dependant = defineStore('dependent', { state: () => ({}), getters: { value: () => old.getStore(pinia).count } })
  expect(dependant.getStore(pinia).value).toBe(1)
  const replacement = defineStore('same', { state: () => ({ count: 20 }) }).getStore(pinia)
  const currentScope = pinia._scopes.get('same')!
  const notify = vi.fn()
  currentScope.listeners.add(notify)
  expect(currentScope).not.toBe(oldScope)
  expect(oldScope.subscribers.size).toBe(0)
  expect(pinia._scopes.get('upstream')!.subscribers.has('same')).toBe(false)
  expect(pinia._scopes.get('dependent')!.getterResultCache.size).toBe(0)
  oldAdd()
  expect(original.count).toBe(2)
  oldPatch({ count: 99 })
  expect(original.count).toBe(99)
  expect(replacement.count).toBe(20)
  expect(notify).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

it('leaves other instances and their Getter graphs and subscriptions intact', () => {
  const definition = defineStore('same', { state: () => ({ count: 1 }), getters: { double: (s) => s.count * 2 } })
  const first = createPinia()
  const second = createPinia()
  const original = definition.getStore(first)
  const survivor = definition.getStore(second)
  const listener = vi.fn()
  survivor.$subscribe(listener)
  expect(survivor.double).toBe(2)
  disposePinia(first)
  survivor.$patch({ count: 2 })
  expect(survivor.double).toBe(4)
  expect(listener).toHaveBeenCalledOnce()
  expect(() => original.count).toThrow(/disposed/)
  expect(getActivePinia()).toBe(second)
})

it('does not auto-dispose Provider instances during StrictMode replay or ordinary unmount', () => {
  const disposed = vi.fn()
  const definition = defineStore('strict-lifetime', { state: () => ({ count: 0 }) })
  const hook = renderHook(() => definition.useStore(), {
    wrapper: ({ children }) => (
      <StrictMode>
        <PiniaProvider
          plugins={[
            ({ onDispose }) => {
              onDispose(disposed)
            }
          ]}
        >
          {children}
        </PiniaProvider>
      </StrictMode>
    )
  })
  const owner = getActivePinia()
  expect(owner._scopes.get('strict-lifetime')!.listeners.size).toBe(1)
  act(() => hook.result.current.$patch({ count: 1 }))
  expect(hook.result.current.count).toBe(1)
  expect(disposed).not.toHaveBeenCalled()
  hook.unmount()
  expect(disposed).not.toHaveBeenCalled()
  expect(owner._scopes.get('strict-lifetime')!.listeners.size).toBe(0)
  disposePinia(owner)
  expect(disposed).toHaveBeenCalledOnce()
})

it('can mount, unsubscribe and explicitly dispose repeatedly without retaining listeners or graphs', () => {
  const definition = defineStore('loop', { state: () => ({ count: 0 }) })
  const cleanup = vi.fn()
  for (let iteration = 0; iteration < 20; iteration++) {
    const pinia = createPinia().use(({ onDispose, pinia }) => {
      pinia.onMutation(vi.fn())
      onStoreDebug(pinia, vi.fn())
      onDispose(cleanup)
    })
    const hook = renderHook(() => definition.useStore())
    const scope = pinia._scopes.get('loop')!
    hook.unmount()
    disposePinia(pinia)
    expect(scope.listeners.size + scope.mutationListeners.size + scope.subscribers.size).toBe(0)
    expect(pinia._m.size + pinia._s.size + pinia._scopes.size).toBe(0)
  }
  expect(cleanup).toHaveBeenCalledTimes(20)
})

it('stops an in-flight dispatch when a listener disposes its instance, without notifying other scopes', () => {
  const pinia = createPinia()
  const source = defineStore('source', { state: () => ({ count: 0 }) })
  const derived = defineStore('derived', { state: () => ({}), getters: { value: () => source.getStore(pinia).count } })
  expect(derived.getStore(pinia).value).toBe(0)
  pinia._scopes.get('source')!.listeners.add(() => {
    disposePinia(pinia)
  })
  const derivedListener = vi.fn()
  pinia._scopes.get('derived')!.listeners.add(derivedListener)
  const business = vi.fn()
  pinia.onMutation(business)
  source.getStore(pinia).$subscribe(business)
  expect(() => source.getStore(pinia).$patch({ count: 1 })).not.toThrow()
  expect(derivedListener).not.toHaveBeenCalled()
  expect(business).not.toHaveBeenCalled()
  expect(pinia.state).toEqual({})
})

it('allows a later cleanup to cancel an earlier registration without executing it', () => {
  const pinia = createPinia()
  const cleanup = vi.fn()
  pinia.use(({ onDispose }) => {
    const cancel = onDispose(cleanup)
    onDispose(cancel)
  })
  defineStore('cancel-during-cleanup', { state: () => ({}) }).getStore(pinia)
  disposePinia(pinia)
  expect(cleanup).not.toHaveBeenCalled()
})

it('reclaims a diagnostic session created only by a failed install without retaining its sequence', () => {
  const pinia = createPinia()
  pinia.use(({ id, pinia, restoreState }) => {
    if (id !== 'debug-failure') return
    onStoreDebug(pinia, vi.fn())
    restoreState({ count: 1 })
    throw new Error('debug install failed')
  })
  expect(() => defineStore('debug-failure', { state: () => ({ count: 0 }) }).getStore(pinia)).toThrow(
    'debug install failed'
  )
  const seen = vi.fn()
  onStoreDebug(pinia, seen)
  defineStore('healthy-debug', { state: () => ({ count: 0 }) })
    .getStore(pinia)
    .$patch({ count: 1 })
  expect(seen).toHaveBeenCalledWith(expect.objectContaining({ mutation: expect.objectContaining({ id: 1 }) }))
  disposePinia(pinia)
})

it('cleans a listener from a superseded nested installation when its instance is disposed', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const pinia = createPinia()
  const replacement = defineStore('reentrant-subscribe', { state: () => ({ count: 2 }) })
  pinia._initialStores['reentrant-subscribe'] = { count: 7 }
  const add = pinia._m.add.bind(pinia._m)
  let replacing = false
  const spy = vi.spyOn(pinia._m, 'add').mockImplementation((listener) => {
    add(listener)
    replacing = true
    replacement.getStore(pinia)
    return pinia._m
  })
  pinia.use(({ pinia }) => {
    if (!replacing) pinia.onMutation(vi.fn())
  })
  const original = defineStore('reentrant-subscribe', { state: () => ({ count: 0 }) })
  expect(original.getStore(pinia).count).toBe(2)
  expect(pinia._m.size).toBe(1)
  expect(replacement.getStore(pinia).count).toBe(2)
  expect(pinia._initialStores).toEqual({})
  spy.mockRestore()
  vi.restoreAllMocks()
  disposePinia(pinia)
})

it('retains a new diagnostic session shared with a successful nested installation', () => {
  const pinia = createPinia()
  const healthy = defineStore('nested-debug', { state: () => ({ count: 0 }) })
  const debug = vi.fn()
  pinia.use(({ id, pinia }) => {
    if (id === 'parent-debug') {
      onStoreDebug(pinia, vi.fn())
      healthy.getStore(pinia)
      throw new Error('parent failed')
    }
    onStoreDebug(pinia, debug)
  })
  expect(() => defineStore('parent-debug', { state: () => ({}) }).getStore(pinia)).toThrow('parent failed')
  healthy.getStore(pinia).$patch({ count: 1 })
  expect(debug).toHaveBeenCalledOnce()
  expect(debug).toHaveBeenCalledWith(expect.objectContaining({ mutation: expect.objectContaining({ id: 1 }) }))
  disposePinia(pinia)
})

it('finishes notifying the original mutation without overwriting a replacement created by its listener', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const pinia = createPinia()
  const original = defineStore('replace-during-notify', { state: () => ({ count: 0 }) }).getStore(pinia)
  const replacement = defineStore('replace-during-notify', { state: () => ({ count: 10 }) })
  const mutation = vi.fn()
  pinia.onMutation(mutation)
  original.$subscribe(() => {
    replacement.getStore(pinia)
  })
  original.$patch({ count: 1 })
  expect(mutation).toHaveBeenCalledOnce()
  expect(mutation).toHaveBeenCalledWith(expect.objectContaining({ store: original, state: { count: 1 } }))
  expect(replacement.getStore(pinia).count).toBe(10)
  expect(pinia.state['replace-during-notify']).toEqual({ count: 10 })
  vi.restoreAllMocks()
  disposePinia(pinia)
})
