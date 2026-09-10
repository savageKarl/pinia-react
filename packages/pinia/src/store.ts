import { type Draft, enablePatches, Immer, type Patch } from 'immer'
import { useCallback, useRef, useSyncExternalStore } from 'react'
import { getActivePinia } from './rootStore'
import type {
  DefineStoreOptions,
  MutationEvent,
  MutationMeta,
  Pinia,
  PiniaPluginContext,
  RestoreStateOptions,
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

const storeDefinitionByPinia = new WeakMap<Pinia, Map<string, unknown>>()

function isAffected(patches: Patch[], trackedPaths: Set<string>): boolean {
  if (trackedPaths.size === 0) return false
  const tracked = Array.from(trackedPaths).map((p) => p.split('.'))

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

// Only plain objects and arrays are safe to wrap in a proxy; Date/Map/Set break their internal slots.
function isPlainObjectOrArray(value: unknown): value is object {
  if (Array.isArray(value)) return true
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
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
    createStoreInstance()
  }

  function resolveGetterDependencies(
    getterName: string,
    getterDepsMap: Map<string, Set<string>>,
    visited = new Set<string>()
  ): Set<string> {
    if (visited.has(getterName)) {
      console.warn(`[pinia-react] Circular dependency in getters detected involving: ${getterName}`)
      return new Set()
    }
    visited.add(getterName)

    const finalDeps = new Set<string>()
    const directDeps = getterDepsMap.get(getterName)

    if (!directDeps) return finalDeps

    for (const dep of directDeps) {
      if (dep in getters) {
        const nestedDeps = resolveGetterDependencies(dep, getterDepsMap, visited)
        nestedDeps.forEach((d) => finalDeps.add(d))
      } else {
        finalDeps.add(dep)
      }
    }
    return finalDeps
  }

  function createStoreInstance(): Store<Id, S, G, A> {
    const pinia = getActivePinia()
    const initialState = options.state()

    let storePublicApi: Store<Id, S, G, A>

    const localScope: StoreScope = {
      currentState: initialState,
      listeners: new Set(),
      getterResultCache: new Map(),
      getterDependencies: new Map(),
      subscribers: new Map(),
      createStoreProxy: (_onAccess?: (path: string[]) => void) => storePublicApi as any
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

      const nextState = immer.produce(oldState, updater as any, (p) => {
        patches = p
      }) as S

      if (patches.length > 0 || meta.type === 'reset') {
        localScope.currentState = nextState
        pinia.state[id] = nextState
        emit(nextState, oldState, patches)
        const event: MutationEvent<S> = {
          storeId: id,
          store: storePublicApi as any,
          state: nextState,
          prevState: oldState,
          patches,
          meta
        }
        pinia._m.forEach((listener) => listener(event))
      }
    }

    const $patch = (updater: (draft: Draft<S>) => void) => {
      internalPatch(
        (draft) => {
          updater(draft)
        },
        { type: 'patch' }
      )
    }

    const $reset = () => internalPatch(() => options.state(), { type: 'reset' })

    const restoreState = (state: S, options: RestoreStateOptions = {}) => {
      internalPatch(() => state, {
        type: options.type ?? 'restore',
        origin: options.origin
      })
    }

    const $subscribe = (callback: SubscriptionCallback<S>) => {
      const listener = (state: S, prev: S) => callback(state, prev)
      localScope.listeners.add(listener as any)
      return () => localScope.listeners.delete(listener as any)
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
      return false
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

    const getAtPath = (path: string[]) => {
      let value: any = localScope.currentState
      for (const key of path) value = value[key]
      return value
    }

    const setAtPath = (draft: Draft<S>, path: string[], value: unknown) => {
      let target: any = draft
      for (let i = 0; i < path.length - 1; i++) target = target[path[i]]
      target[path[path.length - 1]] = value
    }

    const deleteAtPath = (draft: Draft<S>, path: string[]) => {
      let target: any = draft
      for (let i = 0; i < path.length - 1; i++) target = target[path[i]]
      delete target[path[path.length - 1]]
    }

    const createActionStateProxy = (path: string[], meta: MutationMeta): any => {
      return new Proxy(Array.isArray(getAtPath(path)) ? [] : {}, {
        get(_target, key, receiver) {
          const current = getAtPath(path)
          const value = Reflect.get(current, key, receiver)
          if (typeof key === 'symbol' || !isPlainObjectOrArray(value)) return value
          return createActionStateProxy([...path, String(key)], meta)
        },
        set(_target, key, value) {
          internalPatch((draft) => setAtPath(draft, [...path, String(key)], value), meta)
          return true
        },
        deleteProperty(_target, key) {
          internalPatch((draft) => deleteAtPath(draft, [...path, String(key)]), meta)
          return true
        }
      })
    }

    function createStoreProxy(onAccess?: (path: string[]) => void): Store<Id, S, G, A> {
      const createStateProxy = (
        stateTarget: any,
        path: string[],
        onDeepAccess?: (path: string[]) => void,
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
            const dependencies = new Set<string>()
            const prevListenerId = activeListenerId
            const prevGetterKey = activeGetterKey
            activeListenerId = id
            activeGetterKey = strKey

            try {
              const onGetterAccess = (path: string[]) => {
                dependencies.add(path[0])
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
          if (strKey in localScope.currentState || strKey in getters || strKey in wrappedActions) {
            return readonlyWarning()
          }
          return Reflect.set(_target, key, value, receiver)
        }
      }) as Store<Id, S, G, A>
    }

    storePublicApi = createStoreProxy()

    Object.keys(originalActions).forEach((actionName) => {
      const originalAction = (originalActions as any)[actionName]
      ;(wrappedActions as any)[actionName] = (...args: any[]) => {
        let returnValue: any
        let draftActive = true
        const meta: MutationMeta = { type: 'action', action: actionName, args }
        const recipe = (draft: Draft<S>) => {
          const actionContextProxy = new Proxy({} as any, {
            get(_, key) {
              const strKey = String(key)
              if (draftActive && Reflect.has(draft, strKey)) return (draft as any)[strKey]
              if (!draftActive && Reflect.has(localScope.currentState, strKey)) {
                const value = (localScope.currentState as any)[strKey]
                if (value !== null && typeof value === 'object') return createActionStateProxy([strKey], meta)
                return value
              }
              if (strKey in getters) {
                if (draftActive) return (getters as any)[strKey].call(actionContextProxy, draft)
                return Reflect.get(storePublicApi, key, storePublicApi)
              }
              return Reflect.get(storePublicApi, key, storePublicApi)
            },
            set(_, key, value) {
              const path = [String(key)]
              if (draftActive) (draft as any)[path[0]] = value
              else internalPatch((currentDraft) => setAtPath(currentDraft, path, value), meta)
              return true
            },
            deleteProperty(_, key) {
              const path = [String(key)]
              if (draftActive) delete (draft as any)[path[0]]
              else internalPatch((currentDraft) => deleteAtPath(currentDraft, path), meta)
              return true
            }
          })
          returnValue = originalAction.apply(actionContextProxy, args)
        }
        internalPatch(recipe, meta)
        draftActive = false
        return returnValue
      }
    })

    localScope.createStoreProxy = createStoreProxy as any

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

    pinia._s.set(id, storePublicApi as any)

    return storePublicApi
  }

  function getStore(): Store<Id, S, G, A> {
    const pinia = getActivePinia()
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
    const pinia = getActivePinia()
    ensureStoreInstance(pinia)
    const currentScope = pinia._scopes.get(id)!

    const trackedPaths = useRef(new Set<string>())
    trackedPaths.current.clear()

    const subscribe = useCallback(
      (onStoreChange: () => void) => {
        const listener = (_state: S, _prevState: S, patches: Patch[]) => {
          let shouldUpdate = false
          for (const path of trackedPaths.current) {
            if (path === '$state') {
              shouldUpdate = patches.length > 0
              if (shouldUpdate) break
            }
            const topKey = path.split('.')[0]
            if (topKey in getters) {
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
      trackedPaths.current.add(path.join('.'))
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
