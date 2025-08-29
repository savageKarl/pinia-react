import {
  activeEffect,
  type ComputedRef,
  computed,
  type DebuggerEvent,
  type EffectScope,
  effectScope,
  markRaw,
  nextTick,
  ReactiveEffect,
  reactive,
  toRaw,
  toRefs,
  type UnwrapRef,
  type WatchOptions,
  watch
} from '@maoism/runtime-core'
import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { activePinia, type Pinia, setActivePinia } from './rootStore'
import { addSubscription, triggerSubscriptions } from './subscription'
import {
  type _ActionsTree,
  type _DeepPartial,
  type _GettersTree,
  type _Method,
  type _StoreWithState,
  type DefineSetupStoreOptions,
  type DefineStoreOptions,
  type DefineStoreOptionsInPlugin,
  type Fn,
  MutationType,
  type StateTree,
  type Store,
  type StoreDefinition,
  type StoreOnActionListener,
  type SubscriptionCallback,
  type SubscriptionCallbackMutation
} from './types'
import { mergeReactiveObjects, noop } from './utils'

type _SetType<AT> = AT extends Set<infer T> ? T : never
/**
 * Marks a function as an action for `$onAction`
 * @internal
 */
const ACTION_MARKER = Symbol()
/**
 * Action name symbol. Allows to add a name to an action after defining it
 * @internal
 */
const ACTION_NAME = Symbol()
/**
 * Function type extended with action markers
 * @internal
 */
interface MarkedAction<Fn extends _Method = _Method> {
  (...args: Parameters<Fn>): ReturnType<Fn>
  [ACTION_MARKER]: boolean
  [ACTION_NAME]: string
}

const { assign } = Object

function createOptionsStore<Id extends string, S extends StateTree, G extends _GettersTree<S>, A extends _ActionsTree>(
  id: Id,
  options: DefineStoreOptions<Id, S, G, A>,
  pinia: Pinia
): Store<Id, S, G, A> {
  const { state, actions, getters } = options

  const initialState: StateTree | undefined = pinia.state.value[id]

  let store: Store<Id, S, G, A>

  function setup() {
    if (!initialState) {
      pinia.state.value[id] = state ? state() : {}
    }

    const localState = toRefs(pinia.state.value[id])

    return assign(
      localState,
      actions,
      Object.keys(getters || {}).reduce(
        (computedGetters, name) => {
          if (name in localState) {
            console.warn(
              `[🍍]: A getter cannot have the same name as another state property. Rename one of them. Found with "${name}" in store "${id}".`
            )
          }

          computedGetters[name] = markRaw(
            computed(() => {
              setActivePinia(pinia)
              // it was created just before
              const store = pinia._s.get(id)!
              // @ts-expect-error
              return getters![name].call(store, store)
            })
          )
          return computedGetters
        },
        {} as Record<string, ComputedRef>
      )
    )
  }

  store = createSetupStore(id, setup, options, pinia)

  return store as any
}

function createSetupStore<
  Id extends string,
  SS extends Record<any, unknown>,
  S extends StateTree,
  G extends Record<string, _Method>,
  A extends _ActionsTree
>(
  $id: Id,
  setup: (helpers: SetupStoreHelpers) => SS,
  options: DefineSetupStoreOptions<Id, S, G, A> | DefineStoreOptions<Id, S, G, A> = {},
  pinia: Pinia
): Store<Id, S, G, A> {
  let scope!: EffectScope

  const optionsForPlugin: DefineStoreOptionsInPlugin<Id, S, G, A> = assign({ actions: {} as A }, options)

  const $subscribeOptions: WatchOptions = { deep: true }

  // internal state
  let isListening: boolean // set to true at the end
  let isSyncListening: boolean // set to true at the end
  const subscriptions: Set<SubscriptionCallback<S>> = new Set()
  const actionSubscriptions: Set<StoreOnActionListener<Id, S, G, A>> = new Set()
  const debuggerEvents: DebuggerEvent[] | DebuggerEvent = []
  // const initialState = pinia.state.value[$id] as UnwrapRef<S> | undefined

  let activeListener: symbol | undefined
  function $patch(stateMutation: (state: UnwrapRef<S>) => void): void
  function $patch(partialState: _DeepPartial<UnwrapRef<S>>): void
  function $patch(partialStateOrMutator: _DeepPartial<UnwrapRef<S>> | ((state: UnwrapRef<S>) => void)): void {
    let subscriptionMutation: SubscriptionCallbackMutation<S>
    isListening = isSyncListening = false
    // reset the debugger events since patches are sync
    /* istanbul ignore else */
    // if (__DEV__) {
    //   debuggerEvents = []
    // }
    if (typeof partialStateOrMutator === 'function') {
      partialStateOrMutator(pinia.state.value[$id] as UnwrapRef<S>)
      subscriptionMutation = {
        type: MutationType.patchFunction,
        storeId: $id,
        events: debuggerEvents as DebuggerEvent[]
      }
    } else {
      mergeReactiveObjects(pinia.state.value[$id], partialStateOrMutator)
      subscriptionMutation = {
        type: MutationType.patchObject,
        payload: partialStateOrMutator,
        storeId: $id,
        events: debuggerEvents as DebuggerEvent[]
      }
    }
    activeListener = Symbol()
    const myListenerId = activeListener
    nextTick().then(() => {
      if (activeListener === myListenerId) {
        isListening = true
      }
    })
    isSyncListening = true
    // because we paused the watcher, we need to manually call the subscriptions
    triggerSubscriptions(subscriptions, subscriptionMutation, pinia.state.value[$id] as UnwrapRef<S>)
  }

  const $reset = function $reset(this: _StoreWithState<Id, S, G, A>) {
    const { state } = options as DefineStoreOptions<Id, S, G, A>
    const newState: _DeepPartial<UnwrapRef<S>> = state ? state() : {}
    // we use a patch to group all changes into one single subscription
    this.$patch(($state) => {
      // @ts-expect-error: FIXME: shouldn't error?
      assign($state, newState)
    })
  }

  /**
   * Helper that wraps function so it can be tracked with $onAction
   * @param fn - action to wrap
   * @param name - name of the action
   */
  const action = <Fn extends _Method>(fn: Fn, name: string = ''): Fn => {
    if (ACTION_MARKER in fn) {
      // we ensure the name is set from the returned function
      ;(fn as unknown as MarkedAction<Fn>)[ACTION_NAME] = name
      return fn
    }

    const wrappedAction = function (this: any) {
      setActivePinia(pinia)
      const args = Array.from(arguments)

      const afterCallbackSet: Set<(resolvedReturn: any) => any> = new Set()
      const onErrorCallbackSet: Set<(error: unknown) => unknown> = new Set()
      function after(callback: _SetType<typeof afterCallbackSet>) {
        afterCallbackSet.add(callback)
      }
      function onError(callback: _SetType<typeof onErrorCallbackSet>) {
        onErrorCallbackSet.add(callback)
      }

      // @ts-expect-error
      triggerSubscriptions(actionSubscriptions, {
        args,
        name: wrappedAction[ACTION_NAME],
        store,
        after,
        onError
      })

      let ret: unknown
      try {
        ret = fn.apply(this && this.$id === $id ? this : store, args)
        // handle sync errors
      } catch (error) {
        triggerSubscriptions(onErrorCallbackSet, error)
        throw error
      }

      if (ret instanceof Promise) {
        return ret
          .then((value) => {
            triggerSubscriptions(afterCallbackSet, value)
            return value
          })
          .catch((error) => {
            triggerSubscriptions(onErrorCallbackSet, error)
            return Promise.reject(error)
          })
      }

      // trigger after callbacks
      triggerSubscriptions(afterCallbackSet, ret)
      return ret
    } as MarkedAction<Fn>

    wrappedAction[ACTION_MARKER] = true
    wrappedAction[ACTION_NAME] = name // will be set later

    // @ts-expect-error: we are intentionally limiting the returned type to just Fn
    // because all the added properties are internals that are exposed through `$onAction()` only
    return wrappedAction
  }

  const partialStore = {
    _p: pinia,
    // _s: scope,
    $id,
    $onAction: addSubscription.bind(null, activeComponentCleanUp, actionSubscriptions),
    $patch,
    $reset,
    $subscribe(callback, options = {}) {
      const removeSubscription = addSubscription([[]], subscriptions, callback, options.detached, () => stopWatcher())
      const stopWatcher = scope.run(() =>
        watch(
          () => pinia.state.value[$id] as UnwrapRef<S>,
          (state) => {
            if (options.flush === 'sync' ? isSyncListening : isListening) {
              callback(
                {
                  storeId: $id,
                  type: MutationType.direct,
                  events: debuggerEvents as unknown as DebuggerEvent
                },
                state
              )
            }
          },
          assign({}, $subscribeOptions, options)
        )
      )!

      return removeSubscription
    }
    // $dispose
  } as _StoreWithState<Id, S, G, A>

  const store: Store<Id, S, G, A> = reactive(partialStore) as unknown as Store<Id, S, G, A>

  // store the partial store now so the setup of stores can instantiate each other before they are finished without
  // creating infinite loops.
  pinia._s.set($id, store as Store)

  scope = effectScope()
  const setupStore = scope.run(() => setup({ action }))

  // overwrite existing actions to support $onAction
  for (const key in setupStore) {
    const prop = setupStore[key]

    if (typeof prop === 'function') {
      const actionValue = action(prop as _Method, key)
      // this a hot module replacement store because the hotUpdate method needs
      // @ts-expect-error
      setupStore[key] = actionValue

      // list actions so they can be used in plugins
      // @ts-expect-error
      optionsForPlugin.actions[key] = prop
    }
  }

  assign(store, setupStore)
  // allows retrieving reactive objects with `storeToRefs()`. Must be called after assigning to the reactive object.
  // Make `storeToRefs()` work with `reactive()` #799
  assign(toRaw(store), setupStore)

  // use this instead of a computed with setter to be able to create it anywhere
  // without linking the computed lifespan to wherever the store is first
  // created.
  Object.defineProperty(store, '$state', {
    get: () => pinia.state.value[$id],
    set: (state) => {
      $patch(($state) => {
        // @ts-expect-error: FIXME: shouldn't error?
        assign($state, state)
      })
    }
  })

  // apply all plugins
  pinia._p.forEach((extender) => {
    assign(
      store,
      scope.run(() =>
        extender({
          store: store as Store,
          pinia,
          options: optionsForPlugin
        })
      )!
    )
  })

  isListening = true
  isSyncListening = true
  return store
}

export interface SetupStoreHelpers {
  /**
   * Helper that wraps function so it can be tracked with $onAction when the
   * action is called **within the store**. This helper is rarely needed in
   * applications. It's intended for advanced use cases like Pinia Colada.
   *
   * @param fn - action to wrap
   * @param name - name of the action. Will be picked up by the store at creation
   */
  action: <Fn extends _Method>(fn: Fn, name?: string) => Fn
}

const activeComponentCleanUp: [Fn[]] = [[]]

/**
 * Creates a `useStore` function that retrieves the store instance
 *
 * @param id - id of the store (must be unique)
 * @param options - options to define the store
 */
export function defineStore<
  Id extends string,
  S extends StateTree = {},
  G extends _GettersTree<S> = {},
  // cannot extends ActionsTree because we loose the typings
  A /* extends ActionsTree */ = {}
>(id: Id, options: Omit<DefineStoreOptions<Id, S, G, A>, 'id'>): StoreDefinition<Id, S, G, A> {
  const effectMap = new WeakMap<[string], ReactiveEffect>()
  const subscribeMap = new WeakMap<[string], Fn>()
  const cleanUpMap = new WeakMap<[string], Fn[]>()

  function useStore(pinia?: Pinia | null): Store<Id, S, G, A> {
    if (pinia) setActivePinia(pinia)
    if (!activePinia) {
      throw new Error(
        `[🍍]: "getActivePinia()" was called but there was no active Pinia. Are you trying to use a store before calling "createPinia()"?\n`
      )
    }
    pinia = activePinia!

    const lastEffect = activeEffect.value
    activeEffect.value = undefined

    if (!pinia._s.has(id)) createOptionsStore(id, options as any, pinia)
    activeEffect.value = lastEffect

    const store = pinia._s.get(id)!
    const _id = useRef<[string]>([useId()])
    const storeSnapshotRef = useRef({ ...store })
    const isCollectDep = useRef(false)

    if (!cleanUpMap.get(_id.current)) {
      cleanUpMap.set(_id.current, [])
    }

    activeComponentCleanUp[0] = cleanUpMap.get(_id.current)!

    useEffect(() => {
      activeComponentCleanUp[0] = cleanUpMap.get(_id.current)!
      return () => {
        cleanUpMap.get(_id.current)!.forEach((fn) => {
          fn()
        })
      }
    }, [])

    const subscribe = useCallback((onStoreChange: () => void) => {
      subscribeMap.set(_id.current, onStoreChange)

      return () => {
        // 这里就要调用清除副作用的所有函数。
        const effect = effectMap.get(_id.current)
        if (effect) effect.stop()
        subscribeMap.delete(_id.current)
        effectMap.delete(_id.current)
      }
    }, [])

    useSyncExternalStore(
      subscribe,
      () => storeSnapshotRef.current,
      () => storeSnapshotRef.current
    )

    let effect = effectMap.get(_id.current)
    if (!effect) {
      const fn = () => {
        const onStoreChange = subscribeMap.get(_id.current)
        if (!isCollectDep.current) {
          storeSnapshotRef.current = { ...store }
          onStoreChange?.()
        }
      }

      effect = new ReactiveEffect(fn, noop, () => {
        if (effect?.dirty) effect.run()
      })
      activeEffect.value = effect
      isCollectDep.current = true
      effect.run()
      effectMap.set(_id.current, effect)
      isCollectDep.current = false
    }

    return store as Store<Id, S, G, A>
  }

  useStore.$id = id
  useStore.$getStore = (pinia?: Pinia | null) => {
    if (pinia) setActivePinia(pinia)
    pinia = activePinia!
    if (!pinia._s.has(id)) createOptionsStore(id, options as any, pinia)
    const store = pinia._s.get(id)!
    return store as Store<Id, S, G, A>
  }
  return useStore
}
