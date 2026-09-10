export { createPinia } from './createPinia'
export { getActivePinia, setActivePinia } from './rootStore'
export { defineStore } from './store'

export type {
  DeepReadonly,
  DefineStoreOptions,
  DefineStoreOptionsBase,
  MutationEvent,
  MutationListener,
  MutationMeta,
  MutationType,
  Pinia,
  PiniaCustomProperties,
  PiniaPlugin,
  PiniaPluginContext,
  RestoreStateOptions,
  StatePath,
  StateTree,
  Store,
  StoreDefinition,
  StoreGeneric,
  SubscriptionCallback
} from './types'
