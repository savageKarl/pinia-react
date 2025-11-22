// packages/pinia/src/types.ts

export type StateTree = Record<string, any>

/**
 * 提取 getters 的返回值类型，用于 this.xxx 推断
 */
export type TransformGetters<G> = {
  [K in keyof G]: G[K] extends (state: any) => infer R ? R : never
}

/**
 * 订阅回调：只传当前 state 和上一个 state
 */
export type SubscriptionCallback<S> = (state: S, prevState: S) => void

/**
 * Store 公共 API
 */
export interface StorePublicApi<S> {
  $patch(partialStateOrMutator: Partial<S> | ((draft: any) => void)): void
  $reset(): void
  $subscribe(callback: SubscriptionCallback<S>, options?: { detached?: boolean }): () => void
  $dispose(): void
}

/**
 * 最终的 Store 类型
 */
export type Store<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> = S & TransformGetters<G> & A & StorePublicApi<S> & PiniaCustomProperties<Id, S, G, A>

/**
 * 全局 store 类型
 */
export type StoreGeneric = Store<string, StateTree, Record<string, any>, Record<string, any>>

/**
 * defineStore('id', options) 中的 options 类型
 * 关键修复：getter 函数显式声明 state: S 参数类型
 */
export interface DefineStoreOptions<S extends StateTree, G extends Record<string, any>, A extends Record<string, any>> {
  state?: () => S
  getters?: {
    [K: string]: (this: Readonly<S> & TransformGetters<G>, state: S) => any
  }
  actions?: A & ThisType<S & TransformGetters<G> & A & StorePublicApi<S>>
  hydrate?(storeState: S, initialState: S): void
}

/**
 * 插件内部使用的 options 类型
 */
export interface DefineStoreOptionsInPlugin<
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> {
  state?: () => S
  getters?: G
  actions: A
  hydrate?(storeState: S, initialState: S): void
}

/**
 * defineStore 返回的对象
 */
export interface StoreDefinition<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> {
  useStore: () => Store<Id, S, G, A>
  getStore: () => Store<Id, S, G, A>
}

/**
 * 插件可扩展属性
 */
export interface PiniaCustomProperties<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A extends Record<string, any> = Record<string, any>
> {}

/**
 * Pinia 实例
 */
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
  pinia: Pinia
  store: Store<Id, S, G, A>
  options: DefineStoreOptionsInPlugin<S, G, A>
}
