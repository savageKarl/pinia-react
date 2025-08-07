/* eslint-disable @typescript-eslint/ban-types */
import {
  reactive,
  toRefs,
  markRaw,
  computed,
  watch,
  type ComputedRef
} from '@vue/runtime-core'
import { isFunction } from 'savage-types'

import type {
  StateTree,
  DefineStoreOptions,
  Store,
  _GettersTree,
  _ActionsTree,
  StoreDefinition,
  _DeepPartial,
  _StoreWithState
} from './types'
import { mergeReactiveObjects, setActiveEffect } from './utils'
import { safeHookRun } from './apiEnv'
import { liberate } from './liberate'
import { addSubscriptions, triggerSubscription } from './subscription'

// don't collect effect when loading plugin
let isLoadingPlugin = false

export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S> = {},
  A extends _ActionsTree = {}
>(
  id: Id,
  options: DefineStoreOptions<Id, S, G, A>
): StoreDefinition<Id, S, G, A> {
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

    liberate._state.set(id, $state)

    const store = reactive(
      Object.assign(
        baseStore,
        toRefs($state),
        Object.keys(actions ?? []).reduce(
          (x, y) =>
            Object.assign(x, {
              [y]: function (...args: any) {
                return actions![y].call(store, ...args)
              }
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
    liberate._plugins.forEach((p) => {
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

    liberate._store.set(id, store)
  }

  function useStore() {
    // todo 这里要修改
    // if (!isLoadingPlugin) safeHookRun(() => (activeEffect.value = undefined))
    if (!liberate._store.has(id)) createStore()
    if (!isLoadingPlugin) safeHookRun(() => setActiveEffect())

    isSyncListening = true
    const store = liberate._store.get(id) as Store<Id, S, G, A>
    return store
  }

  useStore.$id = id
  return useStore
}
