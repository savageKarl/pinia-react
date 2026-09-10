import type { Draft, Patch } from 'immer'

export type StateTree = Record<string, any>

export type StatePath = string[]

export type MutationType = 'action' | 'patch' | 'reset' | 'restore'

/** Metadata describing why a state transition was committed. */
export interface MutationMeta {
  type: MutationType
  origin?: string
  action?: string
  args?: unknown[]
}

/** A committed state transition, intended for Pinia plugins. */
export interface MutationEvent<S extends StateTree = StateTree> {
  storeId: string
  store: StoreGeneric
  state: S
  prevState: S
  patches: Patch[]
  meta: MutationMeta
}

export type MutationListener = (event: MutationEvent) => void

export interface RestoreStateOptions {
  type?: Extract<MutationType, 'restore' | 'reset'>
  origin?: string
}

export type TransformGetters<G> = {
  [K in keyof G]: G[K] extends (...args: any[]) => infer R ? R : never
}

export type TransformActions<A> = A

export type SubscriptionCallback<S> = (state: S, prevState: S) => void

export type DeepReadonly<T> = T extends (...args: any[]) => any
  ? T
  : T extends readonly (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T

export interface PiniaCustomProperties<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A extends Record<string, any> = Record<string, any>
> {}

export interface StorePublicApi<Id extends string = string, S = StateTree> {
  readonly $id: Id
  $patch: (updater: (draft: Draft<S>) => void) => void
  $reset: () => void
  $subscribe: (callback: SubscriptionCallback<S>) => () => void
  $state: DeepReadonly<S>
}

export type GetterContext<S, G> = Readonly<S> & TransformGetters<G>

export type ActionContext<S, G, A> = S & TransformGetters<G> & TransformActions<A> & StorePublicApi<string, S>

export type Store<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> = S & TransformGetters<G> & TransformActions<A> & StorePublicApi<Id, S> & PiniaCustomProperties<Id, S, G, A>

export type StoreGeneric = Store<string, StateTree, Record<string, any>, Record<string, any>>

export type GettersImplementation<S> = {
  [K in string]: (state: S) => any
}

/** Extension point for store-option plugins. */
export interface DefineStoreOptionsBase<S extends StateTree, Store> {}

export interface DefineStoreOptions<S extends StateTree, G extends Record<string, any>, A extends Record<string, any>>
  extends DefineStoreOptionsBase<S, Store<string, S, G, A>> {
  state: () => S
  getters?: G & ThisType<GetterContext<S, G>> & GettersImplementation<S>
  actions?: A & ThisType<ActionContext<S, G, A>>
}

export type StoreScope = {
  currentState: StateTree
  listeners: Set<(state: any, prev: any, patches: Patch[]) => void>
  getterResultCache: Map<string, any>
  getterDependencies: Map<string, Set<StatePath>>
  subscribers: Map<string, Set<string>>
  createStoreProxy: (onAccess?: (path: StatePath) => void) => StoreGeneric
}

export interface Pinia {
  state: Record<string, StateTree>
  use(plugin: PiniaPlugin): Pinia
  /** Subscribe to committed mutations from every store in this Pinia instance. */
  onMutation(listener: MutationListener): () => void
  _p: PiniaPlugin[]
  _s: Map<string, StoreGeneric>
  _scopes: Map<string, StoreScope>
  _m: Set<MutationListener>
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
  pinia: Pinia
  /** A plugin-only, fully controlled state replacement operation. */
  restoreState: (state: S, options?: RestoreStateOptions) => void
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

type NamedStoreDefinition<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> = string extends Id
  ? {}
  : {
      [K in `use${Capitalize<Id>}Store`]: () => Store<Id, S, G, A>
    } & {
      [K in `get${Capitalize<Id>}Store`]: () => Store<Id, S, G, A>
    }

export type StoreDefinitionWithNames<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> = StoreDefinition<Id, S, G, A> & NamedStoreDefinition<Id, S, G, A>
