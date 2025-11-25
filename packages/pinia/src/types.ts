import type { Draft } from 'immer'

export type StateTree = Record<string, any>

// 从 getters 对象中提取返回类型
export type TransformGetters<G> = {
  // 使用 infer 关键字来推断函数 G[K] 的返回类型 R
  [K in keyof G]: G[K] extends (...args: any[]) => infer R ? R : never
}

export type TransformActions<A> = A

export type SubscriptionCallback<S> = (state: S, prevState: S) => void

// 用于插件扩展 store 实例的接口
export interface PiniaCustomProperties<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A extends Record<string, any> = Record<string, any>
> {}

// store 上的公共 API
export interface StorePublicApi<S> {
  $patch: (updater: (draft: Draft<S>) => void) => void
  $reset: () => void
  $subscribe: (callback: SubscriptionCallback<S>) => () => void
  $state: S
}

// Getter `this` 上下文的类型
export type GetterContext<S, G> = Readonly<S> & TransformGetters<G>

// Action `this` 上下文的类型
export type ActionContext<S, G, A> = S & TransformGetters<G> & TransformActions<A> & StorePublicApi<S>

// 最终的 Store 类型定义
export type Store<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> = S & // State 属性直接挂在顶层
  TransformGetters<G> & // Getters 也挂在顶层
  TransformActions<A> & // Actions 也挂在顶层
  StorePublicApi<S> & // 内置方法 $patch, $reset 等
  PiniaCustomProperties<Id, S, G, A> // 插件添加的自定义属性

export type StoreGeneric = Store<string, StateTree, Record<string, any>, Record<string, any>>

// 用于 DefineStoreOptions 的 Getters 实现类型，确保它们是函数
export type GettersImplementation<S> = {
  [K in string]: (state: S) => any
}

// defineStore 的 options 对象类型
export interface DefineStoreOptions<S extends StateTree, G extends Record<string, any>, A extends Record<string, any>> {
  state: () => S
  // getters 是可选的
  getters?: G & ThisType<GetterContext<S, G>> & GettersImplementation<S>
  // actions 是可选的
  actions?: A & ThisType<ActionContext<S, G, A>>
}

// Pinia 实例的类型
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

// defineStore 的返回类型
export interface StoreDefinition<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> {
  useStore: () => Store<Id, S, G, A>
  getStore: () => Store<Id, S, G, A>
}
