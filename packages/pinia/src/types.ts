import type { Draft } from 'immer'

export type StateTree = Record<string, any>

export type TransformGetters<G> = {
  [K in keyof G]: G[K] extends (...args: any[]) => infer R ? R : never
}

export type TransformActions<A> = A

export type SubscriptionCallback<S> = (state: S, prevState: S) => void

export interface PiniaCustomProperties<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A extends Record<string, any> = Record<string, any>
> {}

export interface StorePublicApi<S> {
  $patch: (updater: (draft: Draft<S>) => void) => void
  $reset: () => void
  $subscribe: (callback: SubscriptionCallback<S>) => () => void
  $state: S
}

export type GetterContext<S, G> = Readonly<S> & TransformGetters<G>

export type ActionContext<S, G, A> = S & TransformGetters<G> & TransformActions<A> & StorePublicApi<S>

export type Store<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> = S & TransformGetters<G> & TransformActions<A> & StorePublicApi<S> & PiniaCustomProperties<Id, S, G, A>

export type StoreGeneric = Store<string, StateTree, Record<string, any>, Record<string, any>>

export type GettersImplementation<S> = {
  [K in string]: (state: S) => any
}

export interface DefineStoreOptions<S extends StateTree, G extends Record<string, any>, A extends Record<string, any>> {
  state: () => S
  getters?: G & ThisType<GetterContext<S, G>> & GettersImplementation<S>
  actions?: A & ThisType<ActionContext<S, G, A>>
}

export interface Pinia {
  state: Record<string, StateTree>
  use(plugin: PiniaPlugin): Pinia
  _p: PiniaPlugin[]
  _s: Map<string, StoreGeneric>
}

export interface PiniaPlugin {
  (context: PiniaPluginContext): Partial<PiniaCustomProperties> | void
}

export type PiniaPluginContext<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A extends Record<string, any> = Record<string, any>
> = {
  id: Id
  store: Store<Id, S, G, A>
  options: DefineStoreOptions<S, G, A>
}

export interface StoreDefinition<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> {
  useStore: () => Store<Id, S, G, A>
  getStore: () => Store<Id, S, G, A>
}
