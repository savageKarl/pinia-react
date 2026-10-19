import { type Draft, enablePatches, Immer, type Patch } from 'immer'
import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { createActionMeta, runWithAction } from './actionContext'
import {
  debugDependencies,
  debugInvalidation,
  debugMutation,
  debugNotify,
  debugPublish,
  hasDebugEnvironment,
  type StoreDebugCause
} from './diagnostics'
import {
  assertActive,
  closeStore,
  detachStore,
  isDisposed,
  onDispose,
  ownStore,
  ownSubscription,
  runCleanups,
  withPluginScope
} from './lifecycle'
import {
  assertStateValue,
  createMutationProxy,
  createStateWarningProxy,
  isPlainObjectOrArray,
  unwrapStateValue,
  warnIfOpaqueStateValue
} from './mutationProxy'
import { usePiniaContext } from './piniaContext'
import { getActivePinia } from './rootStore'
import type {
  DefineStoreOptions,
  MutationEvent,
  MutationMeta,
  Pinia,
  PiniaPluginContext,
  RestoreStateOptions,
  StatePath,
  StateTree,
  Store,
  StoreDebugReason,
  StoreDefinitionWithNames,
  StoreGeneric,
  StoreScope,
  SubscriptionCallback,
  TransformActions
} from './types'

// Kept local so browser-only TypeScript consumers do not need Node globals.
declare const process: { env: { NODE_ENV?: string } }

enablePatches()

// Isolated Immer instance: keeps `autoFreeze: false` out of the host app's global Immer config.
const immer = new Immer({ autoFreeze: false })

let activeListenerId: string | null = null
let activeGetterKey: string | null = null
let activeGetterPinia: Pinia | undefined
let activeGetterScope: StoreScope | undefined
let activeGetterServerView = false
const useCommitEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// Immutable post-plugin snapshots are kept apart from live state and getter caches.
const serverViews = new WeakMap<
  StoreScope,
  {
    state: StateTree
    createProxy: (onAccess?: (path: StatePath) => void) => StoreGeneric
  }
>()

const storeDefinitionByPinia = new WeakMap<Pinia, Map<string, unknown>>()

function isAffected(patches: Patch[], trackedPaths: Iterable<StatePath>): boolean {
  for (const patch of patches) {
    const patchPath = patch.path
    for (const trackedPath of trackedPaths) {
      const len = Math.min(patchPath.length, trackedPath.length)
      let isPrefixMatch = true
      for (let i = 0; i < len; i++) {
        const patchKey = patchPath[i]
        const trackedKey = trackedPath[i]
        if (String(patchKey) !== trackedKey) {
          isPrefixMatch = false
          break
        }
      }
      if (isPrefixMatch) return true
    }
  }
  return false
}

export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any> = {},
  A extends Record<string, any> = {}
>(id: Id, options: DefineStoreOptions<S, G, A>): StoreDefinitionWithNames<Id, S, G, A> {
  const getters = options.getters || ({} as G)

  function ensureStoreInstance(pinia: Pinia) {
    assertActive(pinia, pinia._scopes.get(id))
    if (pinia._s.has(id)) {
      if (storeDefinitionByPinia.get(pinia)?.get(id) === options) return
      console.warn(
        `[pinia-react] Duplicate store id "${id}" detected. The new definition replaces the previous store with the same id.`
      )
      detachStore(pinia, id, pinia._scopes.get(id)!)
    }
    createStoreInstance(pinia)
  }

  function resolveGetterDependencies(
    getterName: string,
    getterDepsMap: Map<string, Set<StatePath>>,
    visited = new Set<string>()
  ): Set<StatePath> {
    if (visited.has(getterName)) {
      console.warn(`[pinia-react] Circular dependency in getters detected involving: ${getterName}`)
      return new Set()
    }
    visited.add(getterName)

    const finalDeps = new Set<StatePath>()
    const directDeps = getterDepsMap.get(getterName)

    if (!directDeps) return finalDeps

    for (const dep of directDeps) {
      const getterKey = dep.length === 1 && typeof dep[0] === 'string' ? dep[0] : undefined
      if (getterKey && getterKey in getters) {
        const nestedDeps = resolveGetterDependencies(getterKey, getterDepsMap, visited)
        nestedDeps.forEach((d) => finalDeps.add(d))
      } else {
        finalDeps.add(dep)
      }
    }
    return finalDeps
  }

  function createStoreInstance(pinia: Pinia): Store<Id, S, G, A> {
    const defaults = options.state()
    assertStateValue(defaults)
    assertActive(pinia)
    const hasSnapshot = Object.hasOwn(pinia._initialStores, id)
    const snapshot = pinia._initialStores[id]
    if (hasSnapshot) assertStateValue(snapshot)
    const initialState = hasSnapshot ? (JSON.parse(JSON.stringify(snapshot)) as S) : defaults
    delete pinia._initialStores[id]
    pinia.state[id] = initialState

    let storePublicApi: Store<Id, S, G, A>

    const localScope: StoreScope = {
      currentState: initialState,
      listeners: new Set(),
      mutationListeners: new Set(),
      getterResultCache: new Map(),
      getterDependencies: new Map(),
      subscribers: new Map(),
      createStoreProxy: (_onAccess?: (path: StatePath) => void) => storePublicApi as any
    }
    pinia._scopes.set(id, localScope)
    ownStore(pinia, id, localScope)

    let definitionsById = storeDefinitionByPinia.get(pinia)
    if (!definitionsById) {
      definitionsById = new Map()
      storeDefinitionByPinia.set(pinia, definitionsById)
    }
    definitionsById.set(id, options)

    const assertStoreActive = () => assertActive(pinia, localScope)
    const isGetterComputing = new Set<string>()
    const serverGetterCache = new Map<string, unknown>()

    const emit = (nextState: S, oldState: S, patches: Patch[], cause?: StoreDebugCause) => {
      const invalidatedGetters = new Map<string, StoreDebugCause | undefined>()
      localScope.getterDependencies.forEach((_deps, getterName) => {
        const resolvedDeps = resolveGetterDependencies(getterName, localScope.getterDependencies)
        if (isAffected(patches, resolvedDeps) && localScope.getterResultCache.delete(getterName)) {
          invalidatedGetters.set(getterName, cause)
        }
      })

      const updates = new Map<
        string,
        {
          scope: StoreScope
          state: StateTree
          prevState: StateTree
          patches: Patch[]
          cause?: StoreDebugCause
          getters: Map<string, StoreDebugCause | undefined>
        }
      >([
        [id, { scope: localScope, state: nextState, prevState: oldState, patches, cause, getters: invalidatedGetters }]
      ])
      const pending = pinia._scopes.get(id) === localScope ? [{ scope: localScope, cause }] : []
      // Invalidate the entire reachable graph before a listener can refill any cache.
      for (let index = 0; index < pending.length; index++) {
        const source = pending[index]
        source.scope.subscribers.forEach((getterKeys, storeId) => {
          const scope = pinia._scopes.get(storeId)
          if (!scope) return
          const invalidated = new Set<string>()
          getterKeys.forEach((key) => {
            if (scope.getterResultCache.delete(key)) invalidated.add(key)
          })
          // Local Getter chains can depend on a cross-Store Getter rather than a StatePath.
          for (const key of invalidated) {
            scope.getterDependencies.forEach((dependencies, getter) => {
              if (!scope.getterResultCache.has(getter)) return
              for (const path of dependencies) {
                if (path.length === 1 && path[0] === key) {
                  scope.getterResultCache.delete(getter)
                  invalidated.add(getter)
                  break
                }
              }
            })
          }
          if (!invalidated.size) return
          const forwarded =
            hasDebugEnvironment && process.env.NODE_ENV !== 'production' && source.cause
              ? debugInvalidation(source.cause, storeId, [...invalidated])
              : undefined
          let update = updates.get(storeId)
          if (!update) {
            const prevState = scope.currentState
            const state = { ...prevState }
            scope.currentState = state
            pinia.state[storeId] = state
            update = { scope, state, prevState, patches: [], cause: forwarded, getters: new Map() }
            updates.set(storeId, update)
          }
          invalidated.forEach((key) => update.getters.set(key, forwarded))
          // A Store can be reached again through a different Getter; deleting caches bounds cycles.
          pending.push({ scope, cause: forwarded })
        })
      }
      updates.forEach(({ scope, state, prevState, patches, cause, getters }) => {
        if (!isDisposed(pinia) && !isDisposed(scope))
          scope.listeners.forEach((fn) => fn(state, prevState, patches, cause, getters))
      })
    }

    const internalPatch = (updater: (draft: Draft<S>) => void | S, meta: MutationMeta) => {
      assertStoreActive()
      const oldState = localScope.currentState as S
      let patches: Patch[] = []

      let nextState = immer.produce(oldState, updater as any, (p) => {
        patches = p
      }) as S

      // A function patch may assign an action proxy captured outside its recipe.
      // Normalize only changed object values, keeping untouched state and event patches consistent.
      let normalizedPatches: Patch[] | undefined
      let replacements: Patch[] | undefined
      for (let index = 0; index < patches.length; index++) {
        const patch = patches[index]
        if (patch.op === 'remove' || (patch.value !== null && typeof patch.value !== 'object')) continue
        const value = unwrapStateValue(patch.value)
        if (value === patch.value) continue
        normalizedPatches ??= patches.slice()
        replacements ??= []
        normalizedPatches[index] = { ...patch, value }
        replacements.push({ op: 'replace', path: patch.path, value })
      }
      if (normalizedPatches) patches = normalizedPatches
      if (replacements) {
        nextState = immer.applyPatches(nextState, replacements)
      }

      assertStoreActive()
      if (patches.length > 0 || meta.type === 'reset') {
        localScope.currentState = nextState
        if (pinia._scopes.get(id) === localScope) pinia.state[id] = nextState
        const event: MutationEvent<S> = {
          storeId: id,
          store: storePublicApi as any,
          state: nextState,
          prevState: oldState,
          patches,
          meta
        }
        const cause =
          hasDebugEnvironment && process.env.NODE_ENV !== 'production' && pinia._scopes.get(id) === localScope
            ? debugMutation(pinia, event)
            : undefined
        emit(nextState, oldState, patches, cause)
        try {
          localScope.mutationListeners.forEach((listener) => {
            if (!isDisposed(localScope)) listener(event)
          })
          pinia._m.forEach((listener) => {
            if (!isDisposed(localScope)) listener(event)
          })
        } finally {
          if (hasDebugEnvironment && process.env.NODE_ENV !== 'production' && cause && !isDisposed(localScope))
            debugPublish(pinia, cause)
        }
      }
    }

    const patchWithMeta = (updater: ((draft: Draft<S>) => void) | Partial<S>, actionMeta?: MutationMeta) => {
      internalPatch(
        (draft) => {
          if (typeof updater === 'function') updater(createStateWarningProxy(draft))
          else Object.assign(draft, unwrapStateValue(updater))
        },
        { ...actionMeta, type: 'patch' }
      )
    }
    const $patch = (updater: ((draft: Draft<S>) => void) | Partial<S>) => patchWithMeta(updater)
    const resetWithMeta = (actionMeta?: MutationMeta) =>
      internalPatch(() => unwrapStateValue(options.state()), { ...actionMeta, type: 'reset' })
    const $reset = () => resetWithMeta()

    const restoreState = (state: S, options: RestoreStateOptions = {}) => {
      internalPatch(() => unwrapStateValue(state), {
        type: options.type ?? 'restore',
        origin: options.origin
      })
    }

    const $subscribe = (callback: SubscriptionCallback<S>) => {
      assertStoreActive()
      const listener = (event: MutationEvent) =>
        callback(event.state as S, event.prevState as S, event as MutationEvent<S>)
      localScope.mutationListeners.add(listener)
      return ownSubscription(pinia, () => {
        localScope.mutationListeners.delete(listener)
      })
    }

    const originalActions = options.actions || ({} as A)
    const wrappedActions = {} as TransformActions<A>
    const proxyTarget = {}
    const readonlyStateProxyCache = new WeakMap<object, object>()

    const readonlyWarning = () => {
      assertStoreActive()
      console.warn(`[${id}] Store is read-only. Use actions for mutations.`)
      throw new TypeError(`[${id}] Store is read-only. Use actions for mutations.`)
    }

    const createReadonlyStateProxy = (stateTarget: any): any => {
      const cached = readonlyStateProxyCache.get(stateTarget)
      if (cached) return cached

      const proxy = new Proxy(stateTarget, {
        get(obj, key) {
          assertStoreActive()
          const value = Reflect.get(obj, key)
          if (isPlainObjectOrArray(value)) return createReadonlyStateProxy(value)
          if (Object.hasOwn(obj, key)) warnIfOpaqueStateValue(value)
          return value
        },
        has(target, key) {
          assertStoreActive()
          return Reflect.has(target, key)
        },
        ownKeys(target) {
          assertStoreActive()
          return Reflect.ownKeys(target)
        },
        getOwnPropertyDescriptor(target, key) {
          assertStoreActive()
          const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
          if (descriptor && 'value' in descriptor && isPlainObjectOrArray(descriptor.value)) {
            descriptor.value = createReadonlyStateProxy(descriptor.value)
          }
          return descriptor
        },
        set: readonlyWarning,
        deleteProperty: readonlyWarning,
        defineProperty: readonlyWarning,
        setPrototypeOf: readonlyWarning
      })
      readonlyStateProxyCache.set(stateTarget, proxy)
      return proxy
    }

    function createStoreProxy(onAccess?: (path: StatePath) => void, serverView = false): Store<Id, S, G, A> {
      const createStateProxy = (
        stateTarget: any,
        path: StatePath,
        onDeepAccess?: (path: StatePath) => void,
        trackObjectAccess = false
      ): any => {
        return new Proxy(stateTarget, {
          get(obj, key) {
            assertStoreActive()
            if (typeof key === 'symbol') {
              if (Array.isArray(obj) && key === Symbol.iterator) onDeepAccess?.(path)
              return Reflect.get(obj, key)
            }
            if (Array.isArray(obj) && typeof key === 'string' && (key === 'length' || !/^(0|[1-9]\d*)$/.test(key)))
              onDeepAccess?.(path)
            const currentPath = [...path, key]
            const value = Reflect.get(obj, key)
            if (isPlainObjectOrArray(value)) {
              if (trackObjectAccess) onDeepAccess?.(currentPath)
              return createStateProxy(value, currentPath, onDeepAccess, trackObjectAccess)
            }
            onDeepAccess?.(currentPath)
            if (Object.hasOwn(obj, key)) warnIfOpaqueStateValue(value)
            return value
          },
          has(target, key) {
            assertStoreActive()
            return Reflect.has(target, key)
          },
          ownKeys(target) {
            assertStoreActive()
            return Reflect.ownKeys(target)
          },
          getOwnPropertyDescriptor(target, key) {
            assertStoreActive()
            const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
            if (descriptor && 'value' in descriptor && isPlainObjectOrArray(descriptor.value)) {
              descriptor.value = createReadonlyStateProxy(descriptor.value)
            }
            return descriptor
          },
          set: readonlyWarning,
          deleteProperty: readonlyWarning,
          defineProperty: readonlyWarning,
          setPrototypeOf: readonlyWarning
        })
      }

      return new Proxy(proxyTarget as any, {
        get(_target, key, receiver) {
          assertStoreActive()
          const state = serverView ? serverViews.get(localScope)!.state : localScope.currentState

          if (typeof key === 'symbol') return Reflect.get(_target, key, receiver)

          const strKey = String(key)

          if (strKey === '$state') {
            onAccess?.(['$state'])
            return createReadonlyStateProxy(serverView ? serverViews.get(localScope)!.state : localScope.currentState)
          }
          if (strKey === '$id') return id
          if (strKey === '$patch') return $patch
          if (strKey === '$reset') return $reset
          if (strKey === '$subscribe') return $subscribe

          if (strKey in state) {
            const value = state[strKey]
            if (isPlainObjectOrArray(value)) {
              return createStateProxy(value, [strKey], onAccess)
            }
            onAccess?.([strKey])
            if (Object.hasOwn(state, key)) warnIfOpaqueStateValue(value)
            return value
          }

          if (strKey in getters) {
            onAccess?.([strKey])
            const resultCache = serverView ? serverGetterCache : localScope.getterResultCache
            const cacheable = serverView || pinia._scopes.get(id) === localScope
            if (cacheable && resultCache.has(strKey)) return resultCache.get(strKey)
            if (isGetterComputing.has(strKey)) {
              console.warn(`[pinia-react] Circular dependency detected in getter "${strKey}"`)
              return undefined
            }

            isGetterComputing.add(strKey)
            const dependencies = new Set<StatePath>()
            const prevListenerId = activeListenerId
            const prevGetterKey = activeGetterKey
            const prevGetterPinia = activeGetterPinia
            const prevGetterScope = activeGetterScope
            const prevServerView = activeGetterServerView
            activeListenerId = id
            activeGetterKey = strKey
            activeGetterPinia = pinia
            activeGetterScope = localScope
            activeGetterServerView = serverView

            try {
              const onGetterAccess = (path: StatePath) => {
                dependencies.add(path)
              }
              const trackingProxyForThis = createStoreProxy(onGetterAccess, serverView)
              const trackingStateProxy = createStateProxy(state, [], onGetterAccess, true)
              const result = (getters as any)[strKey].call(trackingProxyForThis, trackingStateProxy)
              if (typeof result !== 'function') warnIfOpaqueStateValue(result)

              assertStoreActive()
              if (!serverView) localScope.getterDependencies.set(strKey, dependencies)
              if (cacheable) resultCache.set(strKey, result)
              return result
            } finally {
              activeListenerId = prevListenerId
              activeGetterKey = prevGetterKey
              activeGetterPinia = prevGetterPinia
              activeGetterScope = prevGetterScope
              activeGetterServerView = prevServerView
              isGetterComputing.delete(strKey)
            }
          }

          if (strKey in wrappedActions) return (wrappedActions as any)[strKey]

          return Reflect.get(_target, key, receiver)
        },
        has(target, key) {
          assertStoreActive()
          return Reflect.has(target, key)
        },
        ownKeys(target) {
          assertStoreActive()
          return Reflect.ownKeys(target)
        },
        getOwnPropertyDescriptor(target, key) {
          assertStoreActive()
          return Reflect.getOwnPropertyDescriptor(target, key)
        },
        set(_target, key, value, receiver) {
          assertStoreActive()
          const strKey = String(key)
          if (strKey === '$state') {
            console.warn(`[${id}] Do not replace "$state" directly. Use "$patch()" to replace the whole state.`)
            return false
          }
          if (strKey === '$id') return readonlyWarning()
          if (key in localScope.currentState || strKey in getters || strKey in wrappedActions) {
            return readonlyWarning()
          }
          return Reflect.set(_target, key, value, receiver)
        },
        deleteProperty(_target, key) {
          assertStoreActive()
          if (key in localScope.currentState) return readonlyWarning()
          return Reflect.deleteProperty(_target, key)
        },
        defineProperty(_target, key, descriptor) {
          assertStoreActive()
          if (
            key in localScope.currentState ||
            key in getters ||
            key in wrappedActions ||
            ['$id', '$state', '$patch', '$reset', '$subscribe'].includes(String(key))
          )
            return readonlyWarning()
          return Reflect.defineProperty(_target, key, descriptor)
        }
      }) as Store<Id, S, G, A>
    }

    storePublicApi = createStoreProxy()

    const invokeAction = (actionName: string, args: unknown[], parent?: MutationMeta): unknown => {
      assertStoreActive()
      const meta = createActionMeta(pinia, actionName, args, parent)
      const getActionProperty = (key: PropertyKey) => {
        if (key === '$patch') return (updater: ((draft: Draft<S>) => void) | Partial<S>) => patchWithMeta(updater, meta)
        if (key === '$reset') return () => resetWithMeta(meta)
        if (typeof key === 'string' && Object.hasOwn(originalActions, key))
          return (...nestedArgs: unknown[]) => invokeAction(key, nestedArgs, meta)
        return Reflect.get(storePublicApi, key, storePublicApi)
      }
      const actionProxy = createMutationProxy(
        () => {
          assertStoreActive()
          return localScope.currentState as S
        },
        (updater) => internalPatch(updater, meta),
        getActionProperty
      )
      return runWithAction(pinia, meta, () => originalActions[actionName].apply(actionProxy, args))
    }
    Object.keys(originalActions).forEach((actionName) => {
      ;(wrappedActions as any)[actionName] = (...args: unknown[]) => invokeAction(actionName, args)
    })

    localScope.createStoreProxy = createStoreProxy as any

    pinia._s.set(id, storePublicApi as any)

    onDispose(localScope, () => {
      serverViews.delete(localScope)
      serverGetterCache.clear()
      isGetterComputing.clear()
      if (pinia._scopes.get(id) === localScope || isDisposed(pinia)) definitionsById.delete(id)
      if (!definitionsById.size) storeDefinitionByPinia.delete(pinia)
    })
    try {
      pinia._p.forEach((plugin) => {
        assertStoreActive()
        const pluginResult = withPluginScope(pinia, localScope, () =>
          plugin({
            id,
            store: storePublicApi,
            options,
            pinia,
            restoreState,
            onDispose: (cleanup) => onDispose(localScope, cleanup)
          } as PiniaPluginContext)
        )
        assertStoreActive()
        if (pluginResult) {
          Object.defineProperties(proxyTarget, Object.getOwnPropertyDescriptors(pluginResult))
        }
      })
    } catch (error) {
      const errors = runCleanups(closeStore(pinia, id, localScope))
      if (hasSnapshot && !isDisposed(pinia) && !pinia._scopes.has(id)) pinia._initialStores[id] = snapshot
      if (errors.length) {
        throw new AggregateError([error, ...errors], '[pinia-react] Store initialization and cleanup failed.', {
          cause: error
        })
      }
      throw error
    }

    serverViews.set(localScope, {
      state: localScope.currentState,
      createProxy: (onAccess) => createStoreProxy(onAccess, true)
    })
    return storePublicApi
  }

  function getStore(explicitPinia?: Pinia): Store<Id, S, G, A> {
    if (explicitPinia && activeGetterPinia && explicitPinia !== activeGetterPinia) {
      throw new Error('[pinia-react] A Getter cannot access a Store from a different Pinia instance.')
    }
    const pinia = explicitPinia ?? activeGetterPinia ?? getActivePinia()
    ensureStoreInstance(pinia)

    if (
      activeListenerId &&
      activeGetterKey &&
      activeListenerId !== id &&
      activeGetterScope === pinia._scopes.get(activeListenerId)
    ) {
      const accessedStoreScope = pinia._scopes.get(id)
      if (accessedStoreScope) {
        let subscribers = accessedStoreScope.subscribers.get(activeListenerId)
        if (!subscribers) {
          subscribers = new Set()
          accessedStoreScope.subscribers.set(activeListenerId, subscribers)
        }
        subscribers.add(activeGetterKey)
      }
    }

    if (activeGetterServerView) {
      const view = serverViews.get(pinia._scopes.get(id)!)
      // A plugin can reenter its own Store before the post-plugin snapshot is captured.
      if (view) return view.createProxy() as Store<Id, S, G, A>
    }
    return pinia._s.get(id) as Store<Id, S, G, A>
  }

  function useStore(debugLabel?: string): Store<Id, S, G, A> {
    const contextPinia = usePiniaContext()
    const pinia = contextPinia ?? getActivePinia()
    ensureStoreInstance(pinia)
    const currentScope = pinia._scopes.get(id)!

    const trackedPaths = useRef<Set<StatePath>>(new Set())

    const subscribe = useCallback(
      (onStoreChange: () => void) => {
        assertActive(pinia, currentScope)
        const listener = (
          _state: S,
          _prevState: S,
          patches: Patch[],
          cause?: StoreDebugCause,
          invalidatedGetters?: ReadonlyMap<string, StoreDebugCause | undefined>
        ) => {
          let shouldUpdate = false
          let reason: StoreDebugReason | undefined
          const statePaths: StatePath[] = []
          for (const path of trackedPaths.current) {
            if (path.length === 1 && path[0] === '$state') {
              shouldUpdate = patches.length > 0
              if (shouldUpdate) {
                if (hasDebugEnvironment && process.env.NODE_ENV !== 'production' && cause)
                  reason = { kind: 'all-state' }
                break
              }
            }
            const topKey = path[0]
            if (path.length === 1 && typeof topKey === 'string' && topKey in getters) {
              if (invalidatedGetters?.has(topKey)) {
                cause = invalidatedGetters.get(topKey)
                shouldUpdate = true
                if (hasDebugEnvironment && process.env.NODE_ENV !== 'production' && cause)
                  reason = { kind: 'getter-invalidated', getter: topKey }
                break
              }
            } else statePaths.push(path)
          }
          if (!shouldUpdate && patches.length > 0 && isAffected(patches, statePaths)) {
            shouldUpdate = true
            if (hasDebugEnvironment && process.env.NODE_ENV !== 'production' && cause)
              reason = { kind: 'state-path', path: statePaths.find((path) => isAffected(patches, [path]))! }
          }
          if (shouldUpdate) {
            if (hasDebugEnvironment && process.env.NODE_ENV !== 'production' && cause && reason)
              debugNotify(pinia, id, trackedPaths.current, reason, cause)
            onStoreChange()
          }
        }
        currentScope.listeners.add(listener as any)
        return () => currentScope.listeners.delete(listener as any)
      },
      [currentScope, pinia, id]
    )

    const getSnapshot = useCallback(() => {
      assertActive(pinia, currentScope)
      return currentScope.currentState
    }, [pinia, currentScope])

    const serverView = serverViews.get(currentScope)!
    const getServerSnapshot = useCallback(() => {
      assertActive(pinia, currentScope)
      return serverView
    }, [pinia, currentScope, serverView])
    const snapshot = useSyncExternalStore<StateTree | typeof serverView>(subscribe, getSnapshot, getServerSnapshot)

    const renderPaths = new Set<StatePath>()
    const onAccess = (path: StatePath) => {
      renderPaths.add(path)
    }
    // The render must read the snapshot returned by React, including delayed hydration.
    const trackingProxy =
      snapshot === serverView ? serverView.createProxy(onAccess) : currentScope.createStoreProxy(onAccess)

    // Publish paths only after a render commits so interrupted concurrent renders cannot replace them.
    useCommitEffect(() => {
      trackedPaths.current = renderPaths
      if (hasDebugEnvironment && process.env.NODE_ENV !== 'production')
        debugDependencies(pinia, id, renderPaths, getters, debugLabel)
    })

    return trackingProxy as Store<Id, S, G, A>
  }

  const storeName = (id.charAt(0).toUpperCase() + id.slice(1)) as Capitalize<Id>

  const definition: StoreDefinitionWithNames<Id, S, G, A> = Object.assign(
    { useStore, getStore },
    {
      [`use${storeName}Store`]: useStore,
      [`get${storeName}Store`]: getStore
    }
  ) as unknown as StoreDefinitionWithNames<Id, S, G, A>

  return definition
}
