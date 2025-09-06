import type { EffectScope, Ref } from '@maoism/runtime-core'
import type {
  _ActionsTree,
  _GettersTree,
  DefineStoreOptionsInPlugin,
  PiniaCustomProperties,
  PiniaCustomStateProperties,
  StateTree,
  Store,
  StoreGeneric
} from './types'

/**
 * Get the currently active pinia if there is any.
 */
export const getActivePinia = () => activePinia

/**
 * Every application must own its own pinia to be able to create stores
 */
export interface Pinia {
  /**
   * root state
   */
  state: Ref<Record<string, StateTree>>

  /**
   * Adds a store plugin to extend every store
   *
   * @param plugin - store plugin to add
   */
  use(plugin: PiniaPlugin): Pinia

  /**
   * Installed store plugins
   *
   * @internal
   */
  _p: PiniaPlugin[]

  /**
   * Effect scope the pinia is attached to
   *
   * @internal
   */
  _e: EffectScope

  /**
   * Registry of stores used by this pinia.
   *
   * @internal
   */
  _s: Map<string, StoreGeneric>

  /**
   * Added by `createTestingPinia()` to bypass `useStore(pinia)`.
   *
   * @internal
   */
  _testing?: boolean
}

export let activePinia: Pinia | undefined

export function setActivePinia(_pinia: Pinia) {
  activePinia = _pinia
}

export type PiniaPluginContext<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends _GettersTree<S> = _GettersTree<S>,
  A /* extends _ActionsTree */ = _ActionsTree
> = {
  /**
   * pinia instance.
   */
  pinia: Pinia
  /**
   * Current store being extended.
   */
  store: Store<Id, S, G, A>

  /**
   * Initial options defining the store when calling `defineStore()`.
   */
  options: DefineStoreOptionsInPlugin<Id, S, G , A>
}

/**
 * Plugin to extend every store.
 */
export interface PiniaPlugin {
  /**
   * Plugin to extend every store. Returns an object to extend the store or
   * nothing.
   *
   * @param context - Context
   */
  (context: PiniaPluginContext): Partial<PiniaCustomProperties & PiniaCustomStateProperties> | void
}
