import type { PiniaPluginContext, StateTree, Store, StoreGeneric } from 'pinia-react'

/** Synchronous Web Storage-compatible adapter. Promises are not awaited. */
export interface StorageLike {
  /** Read serialized state, returning null when the key is absent. */
  getItem: (key: string) => string | null
  /** Write serialized state synchronously. No removeItem implementation is required. */
  setItem: (key: string, value: string) => void
}

/** Synchronous serialization of the selected snapshot, not necessarily the complete state. */
export interface Serializer {
  /** Receives a detached snapshot after pick/omit. @default JSON.stringify */
  serialize: (state: StateTree) => string
  /** Return an object to merge. The plugin validates its shape and unsafe keys. @default JSON.parse */
  deserialize: (value: string) => Record<string, unknown>
}

type IsAny<T> = 0 extends 1 & T ? true : false
type PathLeaf =
  | readonly unknown[]
  | Date
  | RegExp
  | ReadonlyMap<unknown, unknown>
  | ReadonlySet<unknown>
  | PromiseLike<unknown>
  | ((...args: never[]) => unknown)
type UnsupportedKey = '' | '__proto__' | 'constructor' | 'prototype' | `${string}.${string}`

/**
 * Suggested dot-separated object paths. Arrays and special objects are whole fields.
 * Recursive types are bounded to keep editor expansion finite; pick/omit also accept dynamic strings.
 */
export type StatePath<S, Depth extends unknown[] = []> = IsAny<S> extends true
  ? never
  : S extends PathLeaf
    ? never
    : Depth['length'] extends 6
      ? never
      : S extends object
        ? {
            [K in keyof S & string]: K extends UnsupportedKey
              ? never
              :
                  | K
                  | (NonNullable<S[K]> extends object
                      ? `${K}.${StatePath<NonNullable<S[K]>, [...Depth, unknown]>}`
                      : never)
          }[keyof S & string]
        : never

/** Plugin context with the current store and its state factory/restore payload preserved. */
export type PersistenceContext<S extends StateTree = StateTree, StoreType = Store<string, S, {}, {}>> = Omit<
  PiniaPluginContext<string, S>,
  'store'
> & { store: StoreType }

/**
 * One persistence strategy. Inline defineStore options infer the complete store automatically.
 * For extracted configurations, the optional second generic can be ReturnType<typeof getStore>.
 */
export interface PersistenceOptions<S extends StateTree = StateTree, StoreType = Store<string, S, {}, {}>> {
  /** Store key, resolved before the factory's global key transform. @default store.$id */
  key?: string | ((storeId: string) => string)
  /** Synchronous adapter. Inherits factory storage or lazily uses browser localStorage. */
  storage?: StorageLike
  /** Serialize/deserialize the selected snapshot. Inherits factory defaults or JSON. */
  serializer?: Serializer
  /** Paths to include on read AND write. Omitted: all state. An empty array selects no fields. */
  pick?: readonly (StatePath<S> | (string & {}))[]
  /** Paths to exclude after pick on read AND write. An empty array excludes nothing. */
  omit?: readonly (StatePath<S> | (string & {}))[]
  /** Log operation/store identifiers without payloads or thrown messages. @default false */
  debug?: boolean
  /** Per-strategy synchronous hook, before reading. Inherits the factory hook if omitted. */
  beforeHydrate?: (context: PersistenceContext<S, StoreType>) => void
  /** Per-strategy synchronous hook, after success (also for absent keys). Skipped after a failure. */
  afterHydrate?: (context: PersistenceContext<S, StoreType>) => void
  /** Report a restore failure. The current store includes state, getters and actions when inferred. */
  onHydrateError?: (error: Error, store: StoreType) => void
  /** Report a save failure. Throwing here never interrupts the core mutation dispatcher. */
  onPersistError?: (error: Error, store: StoreType) => void
}

/** true uses defaults; false opts out; arrays run in order (an empty array is a no-op). */
export type Persist<S extends StateTree = StateTree, StoreType = Store<string, S, {}, {}>> =
  | boolean
  | PersistenceOptions<S, StoreType>
  | readonly PersistenceOptions<S, StoreType>[]

/** Factory defaults for all enabled stores. pick/omit belong to individual strategies. */
export interface PluginOptions extends Pick<PersistenceOptions, 'storage' | 'serializer' | 'debug'> {
  /** Runs per strategy. Global hooks receive a generic context because stores have different shapes. */
  beforeHydrate?: (context: PiniaPluginContext) => void
  /** Runs per successful strategy, including absent keys. */
  afterHydrate?: (context: PiniaPluginContext) => void
  /** Global error handler; use store-level handlers for specific state/getter/action inference. */
  onHydrateError?: (error: Error, store: StoreGeneric) => void
  /** Global error handler. Its own exceptions are isolated. */
  onPersistError?: (error: Error, store: StoreGeneric) => void
  /** Namespace each already-resolved strategy key, not just the original store ID. */
  key?: (storeKey: string) => string
  /** Enable omitted persist options automatically; persist: false still opts out. @default false */
  auto?: boolean
}

export interface HydrateOptions {
  /** Run before/after hooks. Error handlers remain enabled when false. @default true */
  runHooks?: boolean
}

declare module 'pinia-react' {
  interface DefineStoreOptionsBase<S extends StateTree, Store> {
    // Infer state/getters/actions from their definitions, not backwards from persistence callbacks.
    persist?: Persist<NoInfer<S>, NoInfer<Store>>
  }
  interface PiniaCustomProperties {
    /** Restore configured strategies without automatic write-back. Only present on enabled stores. */
    $hydrate?: (options?: HydrateOptions) => void
    /** Save configured strategies immediately, without a mutation. Only present on enabled stores. */
    $persist?: () => void
  }
}
