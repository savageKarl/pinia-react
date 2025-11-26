import { type Draft, enablePatches, type Patch, produce, setAutoFreeze } from 'immer'
import { useCallback, useRef, useSyncExternalStore } from 'react'
import { getActivePinia } from './rootStore'
import type {
  DefineStoreOptions,
  PiniaPluginContext,
  StateTree,
  Store,
  StoreDefinition,
  SubscriptionCallback,
  TransformActions
} from './types'

enablePatches()
setAutoFreeze(false)

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
  let scope: {
    currentState: S
    listeners: Set<(state: S, prev: S, patches: Patch[]) => void>
    getterCache: Map<string, any>
    getterDependencies: Map<string, Set<string>>
    createStoreProxy: (onAccess?: (path: string[]) => void) => Store<Id, S, G, A>
  } | null = null

  function createStoreInstance(): Store<Id, S, G, A> {
    const pinia = getActivePinia()
    const initialState = options.state()

    let storePublicApi: Store<Id, S, G, A>
    let devTools: any
    let isTimeTraveling = false

    const localScope = {
      currentState: initialState,
      listeners: new Set<(state: S, prev: S, patches: Patch[]) => void>(),
      getterCache: new Map<string, any>(),
      getterDependencies: new Map<string, Set<string>>(),
      createStoreProxy: (_onAccess?: (path: string[]) => void) => storePublicApi
    }
    scope = localScope

    const isGetterComputing = new Set<string>()

    const emit = (nextState: S, oldState: S, patches: Patch[]) => {
      scope!.listeners.forEach((fn) => fn(nextState, oldState, patches))
    }

    const internalPatch = (updater: (draft: Draft<S>) => void | S, actionName: string, isReset = false) => {
      if (isTimeTraveling) return

      const oldState = scope!.currentState
      let patches: Patch[] = []

      const nextState = produce(oldState, updater as any, (p) => {
        patches = p
      }) as S

      if (patches.length > 0 || isReset) {
        scope!.currentState = nextState
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
      const listener = (state: S, prev: S) => callback(state, prev)
      scope!.listeners.add(listener)
      return () => scope!.listeners.delete(listener)
    }

    const getters = options.getters || ({} as G)

    const getterInvalidationListener = (_state: S, _prevState: S, patches: Patch[]) => {
      scope!.getterDependencies.forEach((deps, getterName) => {
        if (isAffected(patches, deps)) {
          scope!.getterCache.delete(getterName)
        }
      })
    }
    scope.listeners.add(getterInvalidationListener)

    const originalActions = options.actions || ({} as A)
    const wrappedActions = {} as TransformActions<A>
    const proxyTarget = {}

    function createStoreProxy(onAccess?: (path: string[]) => void): Store<Id, S, G, A> {
      const readonlyWarning = () => {
        console.warn(`[${id}] Store is read-only. Use actions for mutations.`)
        return false
      }

      const createStateProxy = (stateTarget: any, path: string[], dependencies?: Set<string>): any => {
        return new Proxy(stateTarget, {
          get(obj, key) {
            if (typeof key === 'symbol') return Reflect.get(obj, key)
            const currentPath = [...path, String(key)]
            dependencies?.add(currentPath.join('.'))
            onAccess?.(currentPath)

            const value = Reflect.get(obj, key)
            if (typeof value === 'object' && value !== null) {
              return createStateProxy(value, currentPath, dependencies)
            }
            return value
          },
          set: readonlyWarning
        })
      }

      return new Proxy(proxyTarget as any, {
        get(_target, key, receiver) {
          const strKey = String(key)

          if (strKey === '$state') return scope!.currentState
          if (strKey === '$patch') return $patch
          if (strKey === '$reset') return $reset
          if (strKey === '$subscribe') return $subscribe

          const state = scope!.currentState
          if (strKey in state) {
            onAccess?.([strKey])
            const value = state[strKey]
            return typeof value === 'object' && value !== null ? createStateProxy(value, [strKey]) : value
          }

          if (strKey in getters) {
            onAccess?.([strKey])
            if (scope!.getterCache.has(strKey)) return scope!.getterCache.get(strKey)
            if (isGetterComputing.has(strKey)) {
              console.warn(`[pinia-react] Circular dependency detected in getter "${strKey}"`)
              return undefined
            }

            isGetterComputing.add(strKey)
            const dependencies = new Set<string>()

            const trackingProxyForThis = createStoreProxy((path) => {
              const topKey = path[0]
              if (topKey in getters) {
                const nestedDeps = scope!.getterDependencies.get(topKey)
                if (nestedDeps) nestedDeps.forEach((dep) => dependencies.add(dep))
              } else {
                dependencies.add(path.join('.'))
              }
            })

            const trackingStateProxy = createStateProxy(state, [], dependencies)
            const result = (getters as any)[strKey].call(trackingProxyForThis, trackingStateProxy)
            isGetterComputing.delete(strKey)
            scope!.getterDependencies.set(strKey, dependencies)
            scope!.getterCache.set(strKey, result)
            return result
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

          if (strKey in scope!.currentState || strKey in getters || strKey in wrappedActions) {
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

    scope.createStoreProxy = createStoreProxy

    pinia._p.forEach((plugin) => {
      const pluginResult = plugin({ id, store: storePublicApi, options } as PiniaPluginContext)
      if (pluginResult) {
        Object.defineProperties(proxyTarget, Object.getOwnPropertyDescriptors(pluginResult))
      }
    })

    pinia._s.set(id, storePublicApi as any)

    if (typeof window !== 'undefined' && (window as any).__REDUX_DEVTOOLS_EXTENSION__) {
      devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect({ name: id })
      devTools.init(scope.currentState)
      devTools.subscribe((message: any) => {
        if (message.type === 'DISPATCH' && message.state) {
          const newState = JSON.parse(message.state)
          isTimeTraveling = true
          const oldState = scope!.currentState
          scope!.currentState = newState
          pinia.state[id] = newState
          scope!.getterCache.clear()
          emit(newState, oldState, [])
          isTimeTraveling = false
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
    return pinia._s.get(id) as Store<Id, S, G, A>
  }

  function useStore(): Store<Id, S, G, A> {
    getStore()
    const currentScope = scope!

    const trackedPaths = useRef(new Set<string>())
    trackedPaths.current.clear()

    const subscribe = useCallback(
      (onStoreChange: () => void) => {
        const listener = (_state: S, _prevState: S, patches: Patch[]) => {
          if (patches.length === 0) {
            onStoreChange()
            return
          }
          let shouldUpdate = false
          const getters = options.getters || {}
          for (const path of trackedPaths.current) {
            const pathSet = new Set<string>()
            const topKey = path.split('.')[0]
            if (topKey in getters) {
              const deps = currentScope.getterDependencies.get(topKey)
              if (deps) {
                deps.forEach((dep) => pathSet.add(dep))
              }
            } else {
              pathSet.add(path)
            }
            if (isAffected(patches, pathSet)) {
              shouldUpdate = true
              break
            }
          }
          if (shouldUpdate) {
            onStoreChange()
          }
        }
        currentScope.listeners.add(listener)
        return () => currentScope.listeners.delete(listener)
      },
      [options, currentScope]
    )

    const getSnapshot = useCallback(() => currentScope.currentState, [currentScope])

    useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    const trackingProxy = currentScope.createStoreProxy((path) => {
      trackedPaths.current.add(path.join('.'))
    })

    return trackingProxy
  }

  return { useStore, getStore }
}
