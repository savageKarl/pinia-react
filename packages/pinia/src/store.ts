// packages/pinia/src/store.ts

import { type Draft, enablePatches, type Patch, produce, setAutoFreeze } from 'immer'
import { useCallback, useRef, useSyncExternalStore } from 'react'
import { getActivePinia } from './rootStore'
import type { DefineStoreOptions, StateTree, Store, StoreDefinition, SubscriptionCallback } from './types'

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
  G extends Record<string, any>,
  A extends Record<string, any>
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

    const localScope = {
      currentState: initialState,
      listeners: new Set<(state: S, prev: S, patches: Patch[]) => void>(),
      getterCache: new Map<string, any>(),
      getterDependencies: new Map<string, Set<string>>(),
      createStoreProxy: (_onAccess?: (path: string[]) => void) => storePublicApi
    }
    scope = localScope

    const emit = (nextState: S, oldState: S, patches: Patch[]) => {
      scope!.listeners.forEach((fn) => fn(nextState, oldState, patches))
    }

    const internalPatch = (updater: (draft: Draft<S>) => void | S, isReset = false) => {
      const oldState = scope!.currentState
      let patches: Patch[] = []

      const nextState = produce(oldState, updater as any, (p) => {
        patches = p
      }) as S

      if (patches.length > 0 || isReset) {
        scope!.currentState = nextState
        pinia.state[id] = nextState
        emit(nextState, oldState, patches)
      }
    }

    const $patch = (updater: (draft: Draft<S>) => void | S) => internalPatch(updater)
    const $reset = () => internalPatch(() => options.state(), true)
    const $subscribe = (callback: SubscriptionCallback<S>) => {
      const listener = (state: S, prev: S) => callback(state, prev)
      scope!.listeners.add(listener)
      return () => scope!.listeners.delete(listener)
    }

    const actions = options.actions || ({} as A)
    const getters = options.getters || ({} as G)

    const getterInvalidationListener = (_state: S, _prevState: S, patches: Patch[]) => {
      scope!.getterDependencies.forEach((deps, getterName) => {
        if (isAffected(patches, deps)) {
          scope!.getterCache.delete(getterName)
        }
      })
    }
    scope.listeners.add(getterInvalidationListener)

    const createStoreProxy = (onAccess?: (path: string[]) => void): Store<Id, S, G, A> => {
      const isGetterComputing = new Set<string>()

      const createStateProxy = (target: any, path: string[], dependencies?: Set<string>): any => {
        return new Proxy(target, {
          get(obj, key) {
            if (typeof key === 'symbol') return Reflect.get(obj, key)
            const currentPath = [...path, String(key)]
            // 如果是为 getter 收集依赖，则记录深层路径
            dependencies?.add(currentPath.join('.'))
            // 如果是为 React 组件收集依赖，也记录
            onAccess?.(currentPath)

            const value = Reflect.get(obj, key)
            if (typeof value === 'object' && value !== null) {
              return createStateProxy(value, currentPath, dependencies)
            }
            return value
          }
        })
      }

      return new Proxy({} as any, {
        get(_target, key, receiver) {
          const strKey = String(key)

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

            // [核心修复]
            // 创建一个临时的、专门用于追踪 getter 内部依赖的代理。
            // 这个代理会同时追踪 this (其他 getter) 和 state (状态) 的访问。
            const trackingProxyForThis = createStoreProxy((path) => {
              const topKey = path[0]
              // 如果是访问另一个 getter，则将其依赖合并过来
              if (topKey in getters) {
                const nestedDeps = scope!.getterDependencies.get(topKey)
                if (nestedDeps) nestedDeps.forEach((dep) => dependencies.add(dep))
              } else {
                // 否则，记录 state 路径
                dependencies.add(path.join('.'))
              }
            })

            // [核心修复]
            // state 参数也必须是代理，才能追踪到 state.xxx 的访问
            const trackingStateProxy = createStateProxy(state, [], dependencies)

            const result = (getters as any)[strKey].call(trackingProxyForThis, trackingStateProxy)

            isGetterComputing.delete(strKey)
            scope!.getterDependencies.set(strKey, dependencies)
            scope!.getterCache.set(strKey, result)
            return result
          }

          if (strKey in actions) {
            return (actions as any)[strKey].bind(receiver)
          }

          return Reflect.get(_target, key, receiver)
        },
        set() {
          console.warn(`[${id}] Store is read-only. Use $patch for mutations.`)
          return false
        }
      }) as Store<Id, S, G, A>
    }

    scope.createStoreProxy = createStoreProxy
    storePublicApi = createStoreProxy()

    pinia._p.forEach((plugin) => {})

    pinia._s.set(id, storePublicApi as any)
    return storePublicApi
  }

  function getStore(): Store<Id, S, G, A> {
    const pinia = getActivePinia()
    return pinia._s.has(id) ? (pinia._s.get(id) as Store<Id, S, G, A>) : createStoreInstance()
  }

  function useStore(): Store<Id, S, G, A> {
    getStore()

    const trackedPaths = useRef(new Set<string>())
    trackedPaths.current.clear()

    const subscribe = useRef((onStoreChange: () => void) => {
      const listener = (_state: S, _prevState: S, patches: Patch[]) => {
        let shouldUpdate = false
        const getters = options.getters || {}

        for (const path of trackedPaths.current) {
          const pathSet = new Set<string>()
          const topKey = path.split('.')[0]

          if (topKey in getters) {
            const deps = scope!.getterDependencies.get(topKey)
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
      scope!.listeners.add(listener)
      return () => scope!.listeners.delete(listener)
    })

    const getSnapshot = useCallback(() => scope!.currentState, [])

    useSyncExternalStore(subscribe.current, getSnapshot, getSnapshot)

    const trackingProxy = scope!.createStoreProxy((path) => {
      trackedPaths.current.add(path.join('.'))
    })

    return trackingProxy
  }

  return { useStore, getStore }
}
