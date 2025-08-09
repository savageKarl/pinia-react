import {
  reactive,
  toRefs,
  markRaw,
  computed,
  watch,
  ReactiveEffect,
} from "@vue/runtime-core";
import type { ComputedRef } from "@vue/runtime-core";
import { isFunction } from "savage-types";

import type {
  StateTree,
  DefineStoreOptions,
  Store,
  _GettersTree,
  _ActionsTree,
  StoreDefinition,
  _DeepPartial,
  _StoreWithState,
} from "./types";
import { mergeReactiveObjects } from "./utils";
import { pinia } from "./pinia";
import { addSubscriptions, triggerSubscription } from "./subscription";
import React, { useCallback, useId, useRef } from "react";

// don't collect effect when loading plugin
let isLoadingPlugin = false;

export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S> = {},
  A extends _ActionsTree = {}
>(
  id: Id,
  options: DefineStoreOptions<Id, S, G, A>
): StoreDefinition<Id, S, G, A> {
  let isSyncListening = false;

  function createStore() {
    const { state, actions, getters } = options;
    const $state = reactive(state ? state() : {}) as S;

    const initState = state ? state() : {};

    const baseStore = {
      $id: id,
      $state,
      $patch(val: _DeepPartial<S> | ((arg: S) => unknown)) {
        isSyncListening = false;
        if (isFunction(val)) {
          val($state as S);
        } else {
          mergeReactiveObjects($state as S, val);
        }

        isSyncListening = true;
        triggerSubscription($state);
      },
      $reset() {
        this.$patch((v) => {
          Object.assign(v, initState);
        });
      },
      $subscribe(cb: (newValue: S) => unknown) {
        const remove = addSubscriptions(cb, () => unwatch());
        const unwatch = watch(
          $state,
          (state) => {
            if (isSyncListening) {
              cb(state);
            }
          },
          {
            deep: true,
            flush: "sync",
          }
        );
        return remove;
      },
    } as _StoreWithState<Id, S, G, A>;

    pinia._state.set(id, $state);

    const store = reactive(
      Object.assign(
        baseStore,
        toRefs($state),
        Object.keys(actions ?? []).reduce(
          (x, y) =>
            Object.assign(x, {
              [y]: (...args: any) => actions![y].call(store, ...args),
            }),
          {} as A
        ),
        Object.keys(getters || {}).reduce((computedGetters, name) => {
          computedGetters[name] = markRaw(
            computed(() => {
              return getters?.[name].call(store, store);
            })
          );
          return computedGetters;
        }, {} as Record<string, ComputedRef>)
      )
    ) as unknown as Store<Id, S, G, A>;

    const lastLoadingPlugin = isLoadingPlugin;
    isLoadingPlugin = true;
    pinia._plugins.forEach((p) => {
      Object.assign(
        store,
        p({
          store,
          // @ts-ignore
          options,
        }) || {}
      );
    });
    isLoadingPlugin = lastLoadingPlugin;

    pinia._store.set(id, store);
  }

  type Fn = () => void
  const effectMap = new WeakMap<string[], ReactiveEffect>()
  const subscribeMap = new WeakMap<string[], Fn>()

  function useStore() {
    if (!pinia._store.has(id)) createStore();
    const store = pinia._store.get(id) as Store<Id, S, G, A>;
    isSyncListening = true

    const _id = useRef([useId()])
    const storeSnapshotRef = React.useRef({ ...store });

    const subscribe = useCallback((onStoreChange: () => void) => {
      subscribeMap.set(_id.current, onStoreChange)
      return () => {
        subscribeMap.delete(_id.current)
      }
    }, [])

    const snapshot = React.useSyncExternalStore(
      subscribe,
      () => storeSnapshotRef.current,
      () => ({ ...store })
    );

    let effect = effectMap.get(_id.current)
    if (!effect) {
      const fn = () => {
        // 这里有bug，依赖似乎没有收集到。
        // 需要link本地的core进行断点调试啦，有点复杂。
        // 主要是 状态改变了，但是这个回调函数竟然不执行，这才是问题
        const onStoreChange = subscribeMap.get(_id.current)
        onStoreChange?.()
        // debugger
      }
      effect = new ReactiveEffect(fn)
      effect.scheduler = fn
      effect.run()
      effectMap.set(_id.current, effect)
    }


    return snapshot;
  }


  useStore.$id = id;
  return useStore;
}
