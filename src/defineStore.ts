import {
  activeEffect,
  type ComputedRef,
  computed,
  markRaw,
  ReactiveEffect,
  reactive,
  toRefs,
  watch
} from '@maoism/runtime-core'
import React, { useCallback, useId, useRef } from 'react'
import { isFunction } from 'savage-types'
import { pinia } from './pinia'
import { addSubscriptions, triggerSubscription } from './subscription'
import type {
  _ActionsTree,
  _DeepPartial,
  _GettersTree,
  _StoreWithState,
  DefineStoreOptions,
  StateTree,
  Store,
  StoreDefinition
} from './types'
import { mergeReactiveObjects, noop } from './utils'

// don't collect effect when loading plugin
let isLoadingPlugin = false

export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S> = {},
  A extends _ActionsTree = {}
>(id: Id, options: DefineStoreOptions<Id, S, G, A>): StoreDefinition<Id, S, G, A> {
  let isSyncListening = false

  function createStore() {
    const { state, actions, getters } = options
    const $state = reactive(state ? state() : {}) as S

    const initState = state ? state() : {}

    const baseStore = {
      $id: id,
      $state,
      $patch(val: _DeepPartial<S> | ((arg: S) => unknown)) {
        isSyncListening = false
        if (isFunction(val)) {
          val($state as S)
        } else {
          mergeReactiveObjects($state as S, val)
        }

        isSyncListening = true
        triggerSubscription($state)
      },
      $reset() {
        this.$patch((v) => {
          Object.assign(v, initState)
        })
      },
      $subscribe(cb: (newValue: S) => unknown) {
        const remove = addSubscriptions(cb, () => unwatch())
        const unwatch = watch(
          $state,
          (state) => {
            if (isSyncListening) {
              cb(state)
            }
          },
          {
            deep: true,
            flush: 'sync'
          }
        )
        return remove
      }
    } as _StoreWithState<Id, S, G, A>

    pinia._state.set(id, $state)

    const store = reactive(
      Object.assign(
        baseStore,
        toRefs($state),
        Object.keys(actions ?? []).reduce((x, y) => {
          const key = y as keyof A
          return Object.assign(x, {
            [key]: function (this: Store<Id, S, G, A>, ...args: any[]) {
              return (actions as any)[key].call(this, ...args)
            }
          })
        }, {} as A),
        Object.keys(getters || {}).reduce(
          (computedGetters, name) => {
            computedGetters[name] = markRaw(
              computed(() => {
                return getters?.[name].call(store, store)
              })
            )
            return computedGetters
          },
          {} as Record<string, ComputedRef>
        )
      )
    ) as unknown as Store<Id, S, G, A>

    const lastLoadingPlugin = isLoadingPlugin
    isLoadingPlugin = true
    pinia._plugins.forEach((p) => {
      Object.assign(
        store,
        p({
          store,
          // @ts-ignore
          options
        }) || {}
      )
    })
    isLoadingPlugin = lastLoadingPlugin

    pinia._store.set(id, store)
  }

  type Fn = () => void
  const effectMap = new WeakMap<string[], ReactiveEffect>()
  const subscribeMap = new WeakMap<string[], Fn>()

  function useStore() {
    if (!pinia._store.has(id)) createStore()
    const store = pinia._store.get(id) as Store<Id, S, G, A>

    isSyncListening = true

    const _id = useRef([useId()])
    const storeSnapshotRef = React.useRef({ ...store })

    const subscribe = useCallback((onStoreChange: () => void) => {
      subscribeMap.set(_id.current, onStoreChange)

      return () => {
        const effect = effectMap.get(_id.current)
        if (effect) effect.stop()
        subscribeMap.delete(_id.current)
        effectMap.delete(_id.current)
      }
    }, [])

    React.useSyncExternalStore(
      subscribe,
      () => storeSnapshotRef.current,
      () => ({ ...store })
    )

    let effect = effectMap.get(_id.current)
    if (!effect) {
      const fn = () => {
        const onStoreChange = subscribeMap.get(_id.current)
        onStoreChange?.()
      }

      effect = new ReactiveEffect(fn, noop, () => {
        storeSnapshotRef.current = { ...store }
        if (effect?.dirty) effect.run()
      })
      activeEffect.value = effect
      effect.run()
      effectMap.set(_id.current, effect)
    }

    return store
  }

  useStore.$id = id
  return useStore
}
