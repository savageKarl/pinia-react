import { type Draft, enablePatches, type Patch, produce, setAutoFreeze } from 'immer'
import { useCallback, useRef, useSyncExternalStore } from 'react'
import { getActivePinia } from './rootStore'
import type {
  DefineStoreOptions,
  PiniaPluginContext,
  StateTree,
  Store,
  StoreDefinition,
  StoreScope,
  SubscriptionCallback,
  TransformActions
} from './types'

enablePatches()
setAutoFreeze(false)

let activeListenerId: string | null = null
let activeGetterKey: string | null = null

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

export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any> = {},
  A extends Record<string, any> = {}
>(id: Id, options: DefineStoreOptions<S, G, A>): StoreDefinition<Id, S, G, A> {
  const getters = options.getters || ({} as G)

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
    let devTools: any
    let isTimeTraveling = false

    const localScope: StoreScope = {
      currentState: initialState,
      listeners: new Set(),
      getterCache: new Map(),
      getterDependencies: new Map(),
      subscribers: new Map(),
      createStoreProxy: (_onAccess?: (path: string[]) => void) => storePublicApi as any
    }
    pinia._scopes.set(id, localScope)

    const isGetterComputing = new Set<string>()

    const emit = (nextState: S, oldState: S, patches: Patch[]) => {
      localScope.listeners.forEach((fn) => fn(nextState, oldState, patches))

      localScope.subscribers.forEach((getterKeys, storeId) => {
        const subscriberScope = pinia._scopes.get(storeId)
        if (!subscriberScope) return
        let shouldNotify = false
        getterKeys.forEach((key) => {
          if (subscriberScope.getterCache.has(key)) {
            subscriberScope.getterCache.delete(key)
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

    const internalPatch = (updater: (draft: Draft<S>) => void | S, actionName: string, isReset = false) => {
      if (isTimeTraveling) return

      const oldState = localScope.currentState as S
      let patches: Patch[] = []

      const nextState = produce(oldState, updater as any, (p) => {
        patches = p
      }) as S

      if (patches.length > 0 || isReset) {
        localScope.currentState = nextState
        pinia.state[id] = nextState
        if (devTools) {
          devTools.send({ type: actionName, payload: patches }, nextState)
        }
        emit(nextState, oldState, patches)
      }
    }

    const $patch = (updater: (draft: Draft<S>) => void) => {
      internalPatch((draft) => {
        updater(draft)
      }, '@patch')
    }

    const $reset = () => internalPatch(() => options.state(), '@reset', true)

    const $subscribe = (callback: SubscriptionCallback<S>) => {
      const listener = (state: S, prev: S, patches: Patch[]) => callback(state, prev, patches)
      localScope.listeners.add(listener as any)
      return () => localScope.listeners.delete(listener as any)
    }

    const getterInvalidationListener = (_state: S, _prevState: S, patches: Patch[]) => {
      localScope.getterDependencies.forEach((_deps, getterName) => {
        const resolvedDeps = resolveGetterDependencies(getterName, localScope.getterDependencies)
        if (isAffected(patches, resolvedDeps)) {
          localScope.getterCache.delete(getterName)
        }
      })
    }
    localScope.listeners.add(getterInvalidationListener as any)

    const originalActions = options.actions || ({} as A)
    const wrappedActions = {} as TransformActions<A>
    const proxyTarget = {}

    function createStoreProxy(onAccess?: (path: string[]) => void): Store<Id, S, G, A> {
      const readonlyWarning = () => {
        console.warn(`[${id}] Store is read-only. Use actions for mutations.`)
        return false
      }

      const createStateProxy = (stateTarget: any, path: string[], onDeepAccess?: (path: string[]) => void): any => {
        return new Proxy(stateTarget, {
          get(obj, key) {
            if (typeof key === 'symbol') return Reflect.get(obj, key)
            const currentPath = [...path, String(key)]
            const value = Reflect.get(obj, key)
            if (typeof value === 'object' && value !== null) {
              return createStateProxy(value, currentPath, onDeepAccess)
            }
            onDeepAccess?.(currentPath)
            return value
          },
          set: readonlyWarning
        })
      }

      return new Proxy(proxyTarget as any, {
        get(_target, key, receiver) {
          const strKey = String(key)

          if (strKey === '$state') return localScope.currentState
          if (strKey === '$patch') return $patch
          if (strKey === '$reset') return $reset
          if (strKey === '$subscribe') return $subscribe

          const state = localScope.currentState
          if (strKey in state) {
            const value = state[strKey]
            if (typeof value === 'object' && value !== null) {
              return createStateProxy(value, [strKey], onAccess)
            }
            onAccess?.([strKey])
            return value
          }

          if (strKey in getters) {
            onAccess?.([strKey])
            if (localScope.getterCache.has(strKey)) return localScope.getterCache.get(strKey)
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
              const trackingStateProxy = createStateProxy(state, [], onGetterAccess)
              const result = (getters as any)[strKey].call(trackingProxyForThis, trackingStateProxy)

              localScope.getterDependencies.set(strKey, dependencies)
              localScope.getterCache.set(strKey, result)
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
        const recipe = (draft: Draft<S>) => {
          const actionContextProxy = new Proxy({} as any, {
            get(_, key) {
              const strKey = String(key)
              if (Reflect.has(draft, strKey)) return (draft as any)[strKey]
              if (strKey in getters) {
                return (getters as any)[strKey].call(actionContextProxy, draft)
              }
              return Reflect.get(storePublicApi, key, storePublicApi)
            },
            set(_, key, value) {
              ;(draft as any)[String(key)] = value
              return true
            }
          })
          returnValue = originalAction.apply(actionContextProxy, args)
        }
        internalPatch(recipe, actionName)
        return returnValue
      }
    })

    localScope.createStoreProxy = createStoreProxy as any

    pinia._p.forEach((plugin) => {
      const pluginResult = plugin({ id, store: storePublicApi, options } as PiniaPluginContext)
      if (pluginResult) {
        Object.defineProperties(proxyTarget, Object.getOwnPropertyDescriptors(pluginResult))
      }
    })

    pinia._s.set(id, storePublicApi as any)

    if (typeof window !== 'undefined' && (window as any).__REDUX_DEVTOOLS_EXTENSION__) {
      devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect({ name: id })
      devTools.init(localScope.currentState)

      devTools.subscribe((message: any) => {
        if (message.type === 'DISPATCH') {
          const payloadType = message.payload?.type

          switch (payloadType) {
            case 'JUMP_TO_STATE':
            case 'JUMP_TO_ACTION':
            case 'IMPORT_STATE': {
              const newState = typeof message.state === 'string' ? JSON.parse(message.state) : message.state
              if (!newState || typeof newState !== 'object') return

              isTimeTraveling = true
              const oldState = localScope.currentState as S
              localScope.currentState = newState
              pinia.state[id] = newState
              localScope.getterCache.clear()
              emit(newState, oldState, [])
              isTimeTraveling = false
              break
            }

            case 'COMMIT': {
              devTools.init(localScope.currentState)
              break
            }

            case 'ROLLBACK': {
              const newState = typeof message.state === 'string' ? JSON.parse(message.state) : message.state
              if (!newState || typeof newState !== 'object') return

              isTimeTraveling = true
              const oldState = localScope.currentState as S
              localScope.currentState = newState
              pinia.state[id] = newState
              localScope.getterCache.clear()
              emit(newState, oldState, [])
              isTimeTraveling = false
              break
            }

            case 'RESET': {
              const originalState = options.state()
              devTools.init(originalState)
              internalPatch(() => originalState, '@reset', true)
              break
            }

            default:
              break
          }
        }
      })
    }

    return storePublicApi
  }

  function getStore(): Store<Id, S, G, A> {
    const pinia = getActivePinia()

    if (!pinia._s.has(id)) {
      createStoreInstance()
    }

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
    if (!pinia._s.has(id)) {
      createStoreInstance()
    }
    const currentScope = pinia._scopes.get(id)!

    const trackedPaths = useRef(new Set<string>())
    trackedPaths.current.clear()

    const subscribe = useCallback(
      (onStoreChange: () => void) => {
        const listener = (_state: S, _prevState: S, patches: Patch[]) => {
          let shouldUpdate = false
          for (const path of trackedPaths.current) {
            const topKey = path.split('.')[0]
            if (topKey in getters) {
              if (!currentScope.getterCache.has(topKey)) {
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

  return { useStore, getStore }
}
