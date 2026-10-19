import { assertActive, currentPluginScope, onDispose, ownSubscription } from './lifecycle'
import type {
  MutationEvent,
  Pinia,
  StatePath,
  StoreDebugEvent,
  StoreDebugListener,
  StoreDebugMutation,
  StoreDebugReason
} from './types'

// Kept local so browser-only TypeScript consumers do not need Node globals.
declare const process: { env: { NODE_ENV?: string } }

// A missing browser environment disables diagnostics, not ordinary Store operations.
export const hasDebugEnvironment = /* @__PURE__ */ (() => {
  try {
    const environment = process.env.NODE_ENV
    return environment === undefined || typeof environment === 'string'
  } catch {
    return false
  }
})()

/** Per-Mutation buffer; callbacks run only after business dispatch and cache invalidation. */
export interface StoreDebugCause {
  readonly mutation: StoreDebugMutation
  readonly via: readonly { readonly storeId: string; readonly getters: readonly string[] }[]
  readonly events: StoreDebugEvent[]
}

type DebugSession = {
  listeners: Set<StoreDebugListener>
  sequence: number
  labels: WeakMap<Set<StatePath>, string>
}
let sessions: WeakMap<Pinia, DebugSession> | undefined

function sessionFor(pinia: Pinia) {
  if (!hasDebugEnvironment || process.env.NODE_ENV === 'production') return
  const session = sessions?.get(pinia)
  return session?.listeners.size ? session : undefined
}

/** Development-only observer. Labels and reads are captured from the next committed render. */
export function onStoreDebug(pinia: Pinia, listener: StoreDebugListener): () => void {
  assertActive(pinia, currentPluginScope(pinia))
  if (!hasDebugEnvironment || process.env.NODE_ENV === 'production') return () => {}
  sessions ??= new WeakMap()
  let session = sessions.get(pinia)
  if (!session) {
    session = { listeners: new Set(), sequence: 0, labels: new WeakMap() }
    sessions.set(pinia, session)
    const ownedSession = session
    const cancelInstanceCleanup = onDispose(pinia, () => {
      ownedSession.listeners.clear()
      sessions?.delete(pinia)
    })
    const scope = currentPluginScope(pinia)
    if (scope) {
      onDispose(scope, () => {
        if (ownedSession.listeners.size) return
        cancelInstanceCleanup()
        if (sessions?.get(pinia) === ownedSession) sessions.delete(pinia)
      })
    }
  }
  const subscription: StoreDebugListener = (event) => listener(event)
  session.listeners.add(subscription)
  return ownSubscription(pinia, () => {
    session.listeners.delete(subscription)
  })
}

function publish(session: DebugSession, event: StoreDebugEvent) {
  Object.freeze(event)
  session.listeners.forEach((listener) => {
    try {
      listener(event)
    } catch {
      // Only diagnostic observers are isolated; business dispatch is outside this boundary.
      try {
        console.warn('[pinia-react] Store debug listener failed.')
      } catch {
        /* Host logging is also untrusted. */
      }
    }
  })
}

function copyPath(path: readonly (string | number)[]) {
  return Object.freeze([...path])
}

export function debugMutation(pinia: Pinia, event: MutationEvent): StoreDebugCause | undefined {
  const session = sessionFor(pinia)
  if (!session) return
  const { type, origin, action, actionId, parentActionId } = event.meta
  const mutation = Object.freeze({
    id: ++session.sequence,
    storeId: event.storeId,
    meta: Object.freeze({ type, origin, action, actionId, parentActionId }),
    patches: Object.freeze(event.patches.map(({ op, path }) => Object.freeze({ op, path: copyPath(path) })))
  })
  // Per-dispatch context, never a mutable global: nested observer writes keep their own source.
  return { mutation, via: Object.freeze([]), events: [Object.freeze({ type: 'mutation', mutation })] }
}

export function debugDependencies(
  pinia: Pinia,
  storeId: string,
  paths: Set<StatePath>,
  getters: Record<string, unknown>,
  label?: string
) {
  const session = sessionFor(pinia)
  if (!session || label === undefined || session.labels.has(paths)) return
  session.labels.set(paths, label)
  const statePaths = []
  const getterNames = []
  for (const path of paths) {
    if (path.length === 1 && typeof path[0] === 'string' && path[0] in getters) getterNames.push(path[0])
    else statePaths.push(copyPath(path))
  }
  publish(session, {
    type: 'dependencies',
    storeId,
    label,
    statePaths: Object.freeze(statePaths),
    getters: Object.freeze(getterNames)
  })
}

export function debugInvalidation(cause: StoreDebugCause, storeId: string, getters: string[]): StoreDebugCause {
  return Object.freeze({
    events: cause.events,
    mutation: cause.mutation,
    via: Object.freeze([...cause.via, Object.freeze({ storeId, getters: Object.freeze(getters) })])
  })
}

export function debugNotify(
  pinia: Pinia,
  storeId: string,
  paths: Set<StatePath>,
  reason: StoreDebugReason,
  cause: StoreDebugCause
) {
  const session = sessionFor(pinia)
  const label = session?.labels.get(paths)
  if (!session || label === undefined) return
  const safeReason = Object.freeze(reason.kind === 'state-path' ? { ...reason, path: copyPath(reason.path) } : reason)
  cause.events.push(
    Object.freeze({ type: 'notify', storeId, label, reason: safeReason, mutation: cause.mutation, via: cause.via })
  )
}

export function debugPublish(pinia: Pinia, cause: StoreDebugCause) {
  const session = sessionFor(pinia)
  if (session) for (const event of cause.events) publish(session, event)
}
