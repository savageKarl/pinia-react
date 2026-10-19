import { clearActionContext } from './actionContext'
import { clearActivePinia } from './rootStore'
import type { Pinia, StoreScope } from './types'

const disposed = new WeakSet<object>()
const storeScopes = new WeakMap<Pinia, Map<StoreScope, string>>()
const cleanups = new WeakMap<object, Set<() => void>>()
let installing: { pinia: Pinia; scope: StoreScope } | undefined

export function assertActive(pinia: Pinia, scope?: StoreScope): void {
  if (disposed.has(pinia) || (scope && disposed.has(scope))) {
    throw new Error('[pinia-react] Cannot use a disposed Pinia or Store.')
  }
}

export function isDisposed(owner: object): boolean {
  return disposed.has(owner)
}

export function onDispose(owner: object, cleanup: () => void): () => void {
  if (disposed.has(owner)) throw new Error('[pinia-react] Cannot register cleanup on a disposed owner.')
  if (typeof cleanup !== 'function') throw new TypeError('[pinia-react] Cleanup must be a function.')
  let entries = cleanups.get(owner)
  if (!entries) {
    entries = new Set()
    cleanups.set(owner, entries)
  }
  let registered: (() => void) | undefined = cleanup
  const entry = () => {
    const run = registered
    registered = undefined
    run?.()
  }
  entries.add(entry)
  return () => {
    registered = undefined
    entries.delete(entry)
  }
}

export function withPluginScope<T>(pinia: Pinia, scope: StoreScope, install: () => T): T {
  const previous = installing
  installing = { pinia, scope }
  try {
    return install()
  } finally {
    installing = previous
  }
}

export function currentPluginScope(pinia: Pinia): StoreScope | undefined {
  return installing?.pinia === pinia ? installing.scope : undefined
}

/** Only registrations made synchronously by this plugin installation inherit its owner. */
export function ownSubscription(pinia: Pinia, stop: () => void): () => void {
  let cancel: (() => void) | undefined
  const scope = currentPluginScope(pinia)
  if (scope) {
    try {
      cancel = onDispose(scope, stop)
    } catch (error) {
      stop()
      throw error
    }
  }
  return () => {
    cancel?.()
    stop()
  }
}

function close(owner: object): (() => void)[] {
  if (disposed.has(owner)) return []
  disposed.add(owner)
  const entries = [...(cleanups.get(owner) ?? [])].reverse()
  cleanups.delete(owner)
  return entries
}

export function ownStore(pinia: Pinia, id: string, scope: StoreScope): void {
  let scopes = storeScopes.get(pinia)
  if (!scopes) {
    scopes = new Map()
    storeScopes.set(pinia, scopes)
  }
  scopes.set(scope, id)
}

/** Unlink the replaced definition without closing captured Store references. */
export function detachStore(pinia: Pinia, id: string, scope: StoreScope): void {
  const pending = [scope]
  const visited = new Set<StoreScope>(pending)
  for (const source of pending) {
    for (const dependentId of source.subscribers.keys()) {
      const dependent = pinia._scopes.get(dependentId)
      if (!dependent || visited.has(dependent)) continue
      visited.add(dependent)
      dependent.getterResultCache.clear()
      pending.push(dependent)
    }
  }
  for (const other of pinia._scopes.values()) other.subscribers.delete(id)
  scope.subscribers.clear()
}

/** Close first; the returned callbacks may run only after every target scope has been closed. */
export function closeStore(pinia: Pinia, id: string, scope: StoreScope): (() => void)[] {
  if (disposed.has(scope)) return []
  const callbacks = close(scope)
  storeScopes.get(pinia)?.delete(scope)
  if (pinia._scopes.get(id) === scope) detachStore(pinia, id, scope)
  scope.listeners.clear()
  scope.mutationListeners.clear()
  scope.getterResultCache.clear()
  scope.getterDependencies.clear()
  scope.subscribers.clear()
  scope.currentState = {}
  if (pinia._scopes.get(id) === scope) {
    pinia._s.delete(id)
    delete pinia.state[id]
  }
  // Retain a closed tombstone during callbacks so cleanup cannot recreate the same ID reentrantly.
  callbacks.push(() => {
    if (pinia._scopes.get(id) === scope) pinia._scopes.delete(id)
  })
  return callbacks
}

export function runCleanups(callbacks: (() => void)[]): unknown[] {
  const errors: unknown[] = []
  for (const cleanup of callbacks) {
    try {
      cleanup()
    } catch (error) {
      errors.push(error)
    }
  }
  return errors
}

/** Permanently release an instance. This is an owner operation, not a React Effect cleanup. */
export function disposePinia(pinia: Pinia): void {
  if (disposed.has(pinia)) return
  const instanceCallbacks = close(pinia)
  const callbacks: (() => void)[] = []
  for (const [scope, id] of [...(storeScopes.get(pinia) ?? [])].reverse())
    callbacks.push(...closeStore(pinia, id, scope))
  storeScopes.delete(pinia)
  pinia._s.clear()
  pinia._scopes.clear()
  pinia._m.clear()
  pinia._p.length = 0
  for (const id of Object.keys(pinia.state)) delete pinia.state[id]
  for (const id of Object.keys(pinia._initialStores)) delete pinia._initialStores[id]
  clearActivePinia(pinia)
  clearActionContext(pinia)
  const errors = runCleanups([...callbacks, ...instanceCallbacks])
  if (errors.length) throw new AggregateError(errors, '[pinia-react] Pinia cleanup failed.')
}
