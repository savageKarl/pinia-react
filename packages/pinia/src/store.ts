// packages/pinia/src/store.ts

import { type Draft, enablePatches, type Patch, produce, setAutoFreeze } from 'immer'
import { useCallback, useRef, useSyncExternalStore } from 'react'
import { activePinia, getActivePinia } from './rootStore'
import type { DefineStoreOptions, StateTree, Store, StoreDefinition, SubscriptionCallback } from './types'

enablePatches()
setAutoFreeze(false)

type TransformGetters<G> = {
  [K in keyof G]: G[K] extends (state: any) => infer R ? R : never
}

type GetterContext<S, G> = Readonly<S> & TransformGetters<G>

type ActionContext<S, G, A> = S & TransformGetters<G> & A & StorePublicApi<S>

interface StorePublicApi<S> {
  $patch(partialStateOrMutator: Partial<S> | ((draft: Draft<S>) => void)): void
  $reset(): void
  $subscribe(callback: SubscriptionCallback<S>, options?: { detached?: boolean }): () => void
  $dispose(): void
}

function defineStore<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
>(id: Id, options: DefineStoreOptions<S, G, A>): StoreDefinition<Id, S, G, A> {
  const pinia = activePinia ?? getActivePinia()

  let listeners: Set<(state: S, prev: S, patches: Patch[]) => void> | undefined

  let createStoreProxy: (stateProvider: () => S, onAccess?: (path: string[]) => void) => Store<Id, S, G, A>

  function getStore(): Store<Id, S, G, A> {
    if (pinia._s.has(id)) {
      return pinia._s.get(id) as Store<Id, S, G, A>
    }

    const initialState = options.state ? options.state() : ({} as S)
    pinia.state[id] = initialState

    let currentState = initialState
    listeners = new Set()

    const emit = (nextState: S, oldState: S, patches: Patch[]) => {
      listeners!.forEach((fn) => fn(nextState, oldState, patches))
    }

    const internalPatch = (updater: (draft: Draft<S>) => void, isReset = false) => {
      const oldState = currentState
      let patches: Patch[] = []

      const nextState = produce(oldState, updater, (p) => {
        patches = p
      }) as S

      if (patches.length > 0 || isReset) {
        currentState = nextState
        pinia.state[id] = nextState
        emit(nextState, oldState, patches)
      }
    }

    const $patch = (partialStateOrMutator: Partial<S> | ((draft: Draft<S>) => void)) => {
      if (typeof partialStateOrMutator === 'function') {
        internalPatch(partialStateOrMutator)
      } else {
        internalPatch((draft) => Object.assign(draft, partialStateOrMutator))
      }
    }

    const $reset = () => internalPatch(() => options.state!(), true)

    const $subscribe = (callback: SubscriptionCallback<S>, _opts?: { detached?: boolean }) => {
      const listener = (state: S, prev: S) => callback(state, prev)
      listeners!.add(listener)
      return () => listeners!.delete(listener)
    }

    const $dispose = () => {
      listeners!.clear()
      pinia._s.delete(id)
      delete pinia.state[id]
      listeners = undefined
    }

    const actions = options.actions || ({} as A & ThisType<ActionContext<S, G, A>>)
    const getters = options.getters || ({} as G & ThisType<GetterContext<S, G>>)

    createStoreProxy = (stateProvider, onAccess) => {
      const deepProxy = (target: any, path: string[]): any => {
        return new Proxy(target, {
          get(obj, key) {
            if (typeof key === 'symbol') return Reflect.get(obj, key)
            const cur = [...path, String(key)]
            if (onAccess) onAccess(cur)

            const val = Reflect.get(obj, key)
            if (typeof val === 'object' && val !== null) {
              return deepProxy(val, cur)
            }
            return val
          }
        })
      }

      return new Proxy({} as any, {
        get(_t, key, receiver) {
          const k = String(key)
          if (k === '$patch') return $patch
          if (k === '$reset') return $reset
          if (k === '$subscribe') return $subscribe
          if (k === '$dispose') return $dispose

          const state = stateProvider()

          if (k in state) {
            if (onAccess) onAccess([k])
            const v = (state as any)[k]
            return typeof v === 'object' && v !== null ? deepProxy(v, [k]) : v
          }

          if (k in getters) return (getters as any)[k].call(receiver, state)
          if (k in actions) return (actions as any)[k].bind(receiver)

          return undefined
        },
        set() {
          console.warn(`[${id}] Store is read-only. Use $patch to update.`)
          return false
        }
      })
    }

    const storePublicApi = createStoreProxy(() => currentState) as Store<Id, S, G, A>

    // 插件
    pinia._p.forEach((plugin) => {
      const ext = plugin({ pinia, store: storePublicApi, options: { ...options, actions } })
      if (ext) Object.assign(storePublicApi, ext)
    })

    pinia._s.set(id, storePublicApi as any)

    return storePublicApi
  }

  function useStore(): Store<Id, S, G, A> {
    const tracked = useRef<Set<string>>(new Set())

    const subscribe = useCallback((onStoreChange: () => void) => {
      const listener = (_state: S, _prev: S, patches: Patch[]) => {
        const paths = Array.from(tracked.current).map((p) => p.split('.'))
        if (paths.length === 0) return

        const affected = patches.some((p) => {
          const pp = p.path.map(String)
          return paths.some((tp) => {
            const len = Math.min(pp.length, tp.length)
            for (let i = 0; i < len; i++) if (pp[i] !== tp[i]) return false
            return true
          })
        })

        if (affected) onStoreChange()
      }

      listeners!.add(listener)
      return () => listeners!.delete(listener)
    }, [])

    const snapshot = () => getStore().$state

    useSyncExternalStore(subscribe, snapshot, snapshot)

    tracked.current.clear()

    return createStoreProxy(
      () => getStore().$state,
      (path) => {
        tracked.current.add(path.join('.'))
      }
    ) as Store<Id, S, G, A>
  }

  return { useStore, getStore } as unknown as StoreDefinition<Id, S, G, A>
}

export { defineStore }
