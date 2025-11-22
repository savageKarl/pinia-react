// packages/pinia/src/index.ts
export { createPinia } from './createPinia'
export { getActivePinia, setActivePinia } from './rootStore'
export { defineStore } from './store'

export type {
  DefineStoreOptions,
  DefineStoreOptionsInPlugin,
  Pinia,
  PiniaCustomProperties,
  PiniaPlugin,
  PiniaPluginContext,
  StateTree,
  Store,
  StoreDefinition,
  StoreGeneric,
  SubscriptionCallback
} from './types'
