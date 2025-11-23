// packages/pinia/src/types.ts
import type { Draft } from 'immer'

// ==========================================
// 1. TypeScript 类型定义 (严格对齐 App.tsx)
// ==========================================

export type StateTree = Record<string, any>

// 提取 Getter 的返回值类型
export type TransformGetters<G> = {
  [K in keyof G]: G[K] extends (...args: any[]) => infer R ? R : never
}

// 提取 Action 类型
export type TransformActions<A> = A

// 订阅回调
export type SubscriptionCallback<S> = (state: S, prevState: S) => void

// Store 的公共 API
export interface StorePublicApi<S> {
  $patch: (updater: (draft: Draft<S>) => void | S) => void
  $reset: () => void
  $subscribe: (callback: SubscriptionCallback<S>) => () => void
}

// -------------------------------------------------
// 上下文类型隔离
// -------------------------------------------------

// Getter 内部 this: 只读 State + 其他 Getters
export type GetterContext<S, G> = Readonly<S> & TransformGetters<G>

// Action 内部 this: 全能上下文
export type ActionContext<S, G, A> = S & TransformGetters<G> & TransformActions<A> & StorePublicApi<S>

// 最终 Store 实例类型
export type Store<
  Id extends string,
  S extends StateTree,
  G extends Record<string, any>,
  A extends Record<string, any>
> = S & TransformGetters<G> & TransformActions<A> & StorePublicApi<S> & PiniaCustomProperties<Id, S, G, A>

// 全局 Store 通用类型
export type StoreGeneric = Store<string, StateTree, Record<string, any>, Record<string, any>>

// 显式定义 Getter 函数的形状，强制其第一个参数为 state
export type GettersImplementation<S, G> = {
  [K in keyof G]: (state: S) => any
}

export interface DefineStoreOptions<S extends StateTree, G extends Record<string, any>, A extends Record<string, any>> {
  state: () => S

  // 类型交叉顺序保证了正确的 'this' 推断和函数签名约束
  getters?: G & ThisType<GetterContext<S, G>> & GettersImplementation<S, G>

  actions?: A & ThisType<ActionContext<S, G, A>>

  // 兼容性保留
  hydrate?(storeState: S, initialState: S): void
}

// ==========================================
// 插件系统支持 (保持原有)
// ==========================================

export interface PiniaCustomProperties<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A extends Record<string, any> = Record<string, any>
> {}

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
