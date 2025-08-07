/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

export type Fun = (...args: any) => any
export type StateTree = Record<string | number | symbol, unknown>

export type Callback<T = StateTree> = (V: T) => void
export type DepsType = Map<unknown, Set<Callback>>

export type ActiveEffect = Callback | undefined

export type _StoreWithGetters<G> = {
  readonly [k in keyof G]: G[k] extends (...args: any[]) => infer R ? R : G[k]
}

export type _ActionsTree = Record<
  string | number | symbol,
  (...args: any[]) => any
>

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LiberateCustomStateProperties<
  S extends StateTree = StateTree
> {}

export type _GettersTree<S extends StateTree> = Record<
  string,
  (state: S & LiberateCustomStateProperties<S>) => any
>

/**
 * Interface to be extended by the user when they add properties through plugins.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LiberateCustomProperties<
  Id extends string = string,
  S extends StateTree = StateTree,
  G /* extends GettersTree<S> */ = _GettersTree<S>,
  A /* extends ActionsTree */ = _ActionsTree
> {}

export type _DeepPartial<T> = { [K in keyof T]?: _DeepPartial<T[K]> }

export interface _StoreWithState<Id extends string, S extends StateTree, G, A> {
  $id: Id
  $state: S & LiberateCustomStateProperties<S>
  $patch(partialState: _DeepPartial<S>): void
  $patch<F extends (state: S) => any>(
    stateMutator: ReturnType<F> extends Promise<any> ? never : F
  ): void
  $reset(): void
  $subscribe(
    callback: (newValue: S) => any,
    options?: { detached: boolean }
  ): any
}

export type Store<
  Id extends string,
  S extends StateTree,
  G,
  A
> = _StoreWithState<Id, S, G, A> &
  S &
  _StoreWithGetters<G> &
  (_ActionsTree extends A ? {} : A) &
  LiberateCustomProperties<Id, S, G, A> &
  LiberateCustomStateProperties<S>

export type StoreGeneric = Store<
  string,
  StateTree,
  _GettersTree<StateTree>,
  _ActionsTree
>

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DefineStoreOptionsBase<S extends StateTree, Store> {}

export interface DefineStoreOptions<
  Id extends string,
  S extends StateTree,
  G,
  A
> extends DefineStoreOptionsBase<S, Store<Id, S, G, A>> {
  state?: () => S

  getters?: G & ThisType<S & _StoreWithGetters<G> & LiberateCustomProperties>

  actions?: A &
    ThisType<
      A &
        S &
        _StoreWithState<Id, S, G, A> &
        _StoreWithGetters<G> &
        LiberateCustomProperties
    >
}

/**
 * Return type of `defineStore()`. Function that allows instantiating a store.
 */
export interface StoreDefinition<
  Id extends string = string,
  S extends StateTree = StateTree,
  G /* extends GettersTree<S> */ = _GettersTree<S>,
  A /* extends ActionsTree */ = _ActionsTree
> {
  /**
   * Returns a store, creates it if necessary.
   */
  (): Store<Id, S, G, A>

  /**
   * Id of the store. Used by map helpers.
   */
  $id: Id
}

export type DepStack = Callback[]

export type LiberatePluginContext<
  Id extends string = string,
  S extends StateTree = StateTree,
  G = _GettersTree<S>,
  A = _ActionsTree
> = {
  options: DefineStoreOptions<Id, S, G, A>
  store: Store<Id, S, G, A>
}

export interface LiberatePlugin {
  (
    context: LiberatePluginContext
  ): Partial<LiberateCustomProperties & LiberateCustomStateProperties> | void
}
