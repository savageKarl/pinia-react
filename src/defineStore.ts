import { reactive, toRefs, markRaw, computed, watch, type ComputedRef, ReactiveEffect } from '@vue/runtime-core'
import { isFunction } from 'savage-types'

import type {
  StateTree,
  DefineStoreOptions,
  Store,
  _GettersTree,
  _ActionsTree,
  StoreDefinition,
  _DeepPartial,
  _StoreWithState,
  Fun
} from './types'
import { mergeReactiveObjects, setActiveEffect } from './utils'
import { pinia } from './pinia'
import { addSubscriptions, triggerSubscription } from './subscription'
import React from 'react'

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
        Object.keys(actions ?? []).reduce(
          (x, y) =>
            Object.assign(x, {
              [y]: (...args: any) => actions![y].call(store, ...args)
            }),
          {} as A
        ),
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


  let render: Fun
  const cb = (fn: Fun) => {
    render = fn

    return () => { }
  }
  function useStore() {
    // todo 这里要修改
    // if (!isLoadingPlugin) safeHookRun(() => (activeEffect.value = undefined))
    if (!pinia._store.has(id)) createStore()
    // if (!isLoadingPlugin) safeHookRun(() => setActiveEffect())
    isSyncListening = true
    const store = pinia._store.get(id) as Store<Id, S, G, A>
    React.useSyncExternalStore(cb, () => store, () => store)
    // 这里可能会有性能问题，要继续研究
    const effect = new ReactiveEffect(render);
    effect.run()

    return store
  }

  useStore.$id = id
  return useStore
}
