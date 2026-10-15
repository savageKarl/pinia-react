import { type Draft, enablePatches, Immer, type Patch } from 'immer'
import { useCallback, useRef, useSyncExternalStore } from 'react'
import { createActionMeta, runWithAction } from './actionContext'
import { createMutationProxy, isPlainObjectOrArray, unwrapStateValue } from './mutationProxy'
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
  StoreDefinitionWithNames,
  StoreScope,
  SubscriptionCallback,
  TransformActions
} from './types'

enablePatches()

// Isolated Immer instance: keeps `autoFreeze: false` out of the host app's global Immer config.
const immer = new Immer({ autoFreeze: false })

let activeListenerId: string | null = null
let activeGetterKey: string | null = null
let activeGetterPinia: Pinia | undefined

const storeDefinitionByPinia = new WeakMap<Pinia, Map<string, unknown>>()

function isAffected(patches: Patch[], trackedPaths: Set<StatePath>): boolean {
  if (trackedPaths.size === 0) return false
  const tracked = Array.from(trackedPaths)

  for (const patch of patches) {
    const patchPath = patch.path.map(String)
    for (const trackedPath of tracked) {
      const len = Math.min(patchPath.length, trackedPath.length)
      let isPrefixMatch = true
      for (let i = 0; i < len; i++) {
        if (patchPath[i] !== trackedPath[i]) {
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
    if (pinia._s.has(id)) {
      if (storeDefinitionByPinia.get(pinia)?.get(id) === options) return
      console.warn(
        `[pinia-react] Duplicate store id "${id}" detected. The new definition replaces the previous store with the same id.`
      )
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
      const getterKey = dep.length === 1 ? dep[0] : undefined
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
    const initialState = Object.hasOwn(pinia._initialStores, id)
      ? (JSON.parse(JSON.stringify(pinia._initialStores[id])) as S)
      : defaults
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

    let definitionsById = storeDefinitionByPinia.get(pinia)
    if (!definitionsById) {
      definitionsById = new Map()
      storeDefinitionByPinia.set(pinia, definitionsById)
    }
    definitionsById.set(id, options)

    const isGetterComputing = new Set<string>()

    const emit = (nextState: S, oldState: S, patches: Patch[]) => {
      localScope.listeners.forEach((fn) => fn(nextState, oldState, patches))

      localScope.subscribers.forEach((getterKeys, storeId) => {
        const subscriberScope = pinia._scopes.get(storeId)
        if (!subscriberScope) return
        let shouldNotify = false
        getterKeys.forEach((key) => {
          if (subscriberScope.getterResultCache.has(key)) {
            subscriberScope.getterResultCache.delete(key)
            shouldNotify = true
          }
        })
        if (shouldNotify) {
          const oldSubState = subscriberScope.currentState
          const newSubState = { ...oldSubState }
          subscriberScope.currentState = newSubState
          pinia.state[storeId] = newSubState

          subscriberScope.listeners.forEach((fn) => fn(newSubState, oldSubState, []))
        }
      })
    }

    const internalPatch = (updater: (draft: Draft<S>) => void | S, meta: MutationMeta) => {
      const oldState = localScope.currentState as S
      let patches: Patch[] = []

      let nextState = immer.produce(oldState, updater as any, (p) => {
        patches = p
      }) as S

      // A function patch may assign an action proxy captured outside its recipe.
      // Normalize only changed values, keeping untouched state and event patches consistent.
      const replacements: Patch[] = []
      patches = patches.map((patch) => {
        if (patch.op === 'remove') return patch
        const value = unwrapStateValue(patch.value)
        if (value === patch.value) return patch
        replacements.push({ op: 'replace', path: patch.path, value })
        return { ...patch, value }
      })
      if (replacements.length > 0) nextState = immer.applyPatches(nextState, replacements)

      if (patches.length > 0 || meta.type === 'reset') {
        localScope.currentState = nextState
        pinia.state[id] = nextState
        const event: MutationEvent<S> = {
          storeId: id,
          store: storePublicApi as any,
          state: nextState,
          prevState: oldState,
          patches,
          meta
        }
        emit(nextState, oldState, patches)
        localScope.mutationListeners.forEach((listener) => listener(event))
        pinia._m.forEach((listener) => listener(event))
      }
    }

    const patchWithMeta = (updater: ((draft: Draft<S>) => void) | Partial<S>, actionMeta?: MutationMeta) => {
      internalPatch(
        (draft) => {
          if (typeof updater === 'function') updater(draft)
          else Object.assign(draft, unwrapStateValue(updater))
        },
        { ...actionMeta, type: 'patch' }
      )
    }
    const $patch = (updater: ((draft: Draft<S>) => void) | Partial<S>) => patchWithMeta(updater)
    const resetWithMeta = (actionMeta?: MutationMeta) =>
      internalPatch(() => options.state(), { ...actionMeta, type: 'reset' })
    const $reset = () => resetWithMeta()

    const restoreState = (state: S, options: RestoreStateOptions = {}) => {
      internalPatch(() => state, {
        type: options.type ?? 'restore',
        origin: options.origin
      })
    }

    const $subscribe = (callback: SubscriptionCallback<S>) => {
      const listener = (event: MutationEvent) =>
        callback(event.state as S, event.prevState as S, event as MutationEvent<S>)
      localScope.mutationListeners.add(listener)
      return () => localScope.mutationListeners.delete(listener)
    }

    const getterInvalidationListener = (_state: S, _prevState: S, patches: Patch[]) => {
      localScope.getterDependencies.forEach((_deps, getterName) => {
        const resolvedDeps = resolveGetterDependencies(getterName, localScope.getterDependencies)
        if (isAffected(patches, resolvedDeps)) {
          localScope.getterResultCache.delete(getterName)
        }
      })
    }
    localScope.listeners.add(getterInvalidationListener as any)

    const originalActions = options.actions || ({} as A)
    const wrappedActions = {} as TransformActions<A>
    const proxyTarget = {}
    const readonlyStateProxyCache = new WeakMap<object, object>()

    const readonlyWarning = () => {
      console.warn(`[${id}] Store is read-only. Use actions for mutations.`)
      throw new TypeError(`[${id}] Store is read-only. Use actions for mutations.`)
    }

    const createReadonlyStateProxy = (stateTarget: any): any => {
      const cached = readonlyStateProxyCache.get(stateTarget)
      if (cached) return cached

      const proxy = new Proxy(stateTarget, {
        get(obj, key) {
          const value = Reflect.get(obj, key)
          if (isPlainObjectOrArray(value)) return createReadonlyStateProxy(value)
          return value
        },
        set: readonlyWarning,
        deleteProperty: readonlyWarning
      })
      readonlyStateProxyCache.set(stateTarget, proxy)
      return proxy
    }

    function createStoreProxy(onAccess?: (path: StatePath) => void): Store<Id, S, G, A> {
      const createStateProxy = (
        stateTarget: any,
        path: StatePath,
        onDeepAccess?: (path: StatePath) => void,
        trackObjectAccess = false
      ): any => {
        return new Proxy(stateTarget, {
          get(obj, key) {
            if (typeof key === 'symbol') return Reflect.get(obj, key)
            const currentPath = [...path, String(key)]
            const value = Reflect.get(obj, key)
            if (isPlainObjectOrArray(value)) {
              if (trackObjectAccess) onDeepAccess?.(currentPath)
              return createStateProxy(value, currentPath, onDeepAccess, trackObjectAccess)
            }
            onDeepAccess?.(currentPath)
            return value
          },
          set: readonlyWarning,
          deleteProperty: readonlyWarning
        })
      }

      return new Proxy(proxyTarget as any, {
        get(_target, key, receiver) {
          const strKey = String(key)

          if (strKey === '$state') {
            onAccess?.(['$state'])
            return createReadonlyStateProxy(localScope.currentState)
          }
          if (strKey === '$id') return id
          if (strKey === '$patch') return $patch
          if (strKey === '$reset') return $reset
          if (strKey === '$subscribe') return $subscribe

          const state = localScope.currentState
          if (strKey in state) {
            const value = state[strKey]
            if (isPlainObjectOrArray(value)) {
              return createStateProxy(value, [strKey], onAccess)
            }
            onAccess?.([strKey])
            return value
          }

          if (strKey in getters) {
            onAccess?.([strKey])
            if (localScope.getterResultCache.has(strKey)) return localScope.getterResultCache.get(strKey)
            if (isGetterComputing.has(strKey)) {
              console.warn(`[pinia-react] Circular dependency detected in getter "${strKey}"`)
              return undefined
            }

            isGetterComputing.add(strKey)
            const dependencies = new Set<StatePath>()
            const prevListenerId = activeListenerId
            const prevGetterKey = activeGetterKey
            const prevGetterPinia = activeGetterPinia
            activeListenerId = id
            activeGetterKey = strKey
            activeGetterPinia = pinia

            try {
              const onGetterAccess = (path: StatePath) => {
                dependencies.add(path)
              }
              const trackingProxyForThis = createStoreProxy(onGetterAccess)
              const trackingStateProxy = createStateProxy(state, [], onGetterAccess, true)
              const result = (getters as any)[strKey].call(trackingProxyForThis, trackingStateProxy)

              localScope.getterDependencies.set(strKey, dependencies)
              localScope.getterResultCache.set(strKey, result)
              return result
            } finally {
              activeListenerId = prevListenerId
              activeGetterKey = prevGetterKey
              activeGetterPinia = prevGetterPinia
              isGetterComputing.delete(strKey)
            }
          }

          if (strKey in wrappedActions) {
            return (wrappedActions as any)[strKey]
          }

          return Reflect.get(_target, key, receiver)
        },
        set(_target, key, value, receiver) {
          const strKey = String(key)
          if (strKey === '$state') {
            console.warn(`[${id}] Do not replace "$state" directly. Use "$patch()" to replace the whole state.`)
            return false
          }
          if (strKey === '$id') return readonlyWarning()
          if (strKey in localScope.currentState || strKey in getters || strKey in wrappedActions) {
            return readonlyWarning()
          }
          return Reflect.set(_target, key, value, receiver)
        }
      }) as Store<Id, S, G, A>
    }

    storePublicApi = createStoreProxy()

    const invokeAction = (actionName: string, args: unknown[], parent?: MutationMeta): unknown => {
      const meta = createActionMeta(pinia, actionName, args, parent)
      const actionProxy = createMutationProxy(
        () => localScope.currentState as S,
        (updater) => internalPatch(updater, meta),
        (key) => {
          if (key === '$patch')
            return (updater: ((draft: Draft<S>) => void) | Partial<S>) => patchWithMeta(updater, meta)
          if (key === '$reset') return () => resetWithMeta(meta)
          if (typeof key === 'string' && Object.hasOwn(originalActions, key)) {
            return (...nestedArgs: unknown[]) => invokeAction(key, nestedArgs, meta)
          }
          return Reflect.get(storePublicApi, key, storePublicApi)
        }
      )
      return runWithAction(pinia, meta, () => (originalActions as any)[actionName].apply(actionProxy, args))
    }
    Object.keys(originalActions).forEach((actionName) => {
      ;(wrappedActions as any)[actionName] = (...args: unknown[]) => invokeAction(actionName, args)
    })

    localScope.createStoreProxy = createStoreProxy as any

    pinia._s.set(id, storePublicApi as any)

    pinia._p.forEach((plugin) => {
      const pluginResult = plugin({
        id,
        store: storePublicApi,
        options,
        pinia,
        restoreState
      } as PiniaPluginContext)
      if (pluginResult) {
        Object.defineProperties(proxyTarget, Object.getOwnPropertyDescriptors(pluginResult))
      }
    })

    return storePublicApi
  }

  function getStore(): Store<Id, S, G, A> {
    const pinia = activeGetterPinia ?? getActivePinia()
    ensureStoreInstance(pinia)

    if (activeListenerId && activeGetterKey && activeListenerId !== id) {
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

    return pinia._s.get(id) as Store<Id, S, G, A>
  }

  function useStore(): Store<Id, S, G, A> {
    const contextPinia = usePiniaContext()
    const pinia = contextPinia ?? getActivePinia()
    ensureStoreInstance(pinia)
    const currentScope = pinia._scopes.get(id)!

    const trackedPaths = useRef(new Set<StatePath>())
    trackedPaths.current.clear()

    const subscribe = useCallback(
      (onStoreChange: () => void) => {
        const listener = (_state: S, _prevState: S, patches: Patch[]) => {
          let shouldUpdate = false
          for (const path of trackedPaths.current) {
            if (path.length === 1 && path[0] === '$state') {
              shouldUpdate = patches.length > 0
              if (shouldUpdate) break
            }
            const topKey = path[0]
            if (path.length === 1 && topKey in getters) {
              if (!currentScope.getterResultCache.has(topKey)) {
                shouldUpdate = true
                break
              }
            } else {
              if (patches.length > 0 && isAffected(patches, new Set([path]))) {
                shouldUpdate = true
                break
              }
            }
          }
          if (shouldUpdate) {
            onStoreChange()
          }
        }
        currentScope.listeners.add(listener as any)
        return () => currentScope.listeners.delete(listener as any)
      },
      [currentScope]
    )

    const getSnapshot = useCallback(() => currentScope.currentState, [currentScope])

    useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    const trackingProxy = currentScope.createStoreProxy((path) => {
      trackedPaths.current.add(path)
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
