import type { PiniaPlugin, PiniaPluginContext } from 'pinia-react'
import type { HydrateOptions, PersistenceOptions, PluginOptions, StorageLike } from './types'
import { filterState, mergeState } from './utils'

const ORIGIN = '@pinia-react/persistedstate'
const jsonSerializer = { serialize: JSON.stringify, deserialize: JSON.parse }

function defaultStorage(): StorageLike | undefined {
  if (typeof window !== 'undefined') return window.localStorage
}

export function createPersistedState(options: PluginOptions = {}): PiniaPlugin {
  return createPersistencePlugin(options)
}

/** Internal storage policy shared with the explicit Cookie/SSR entry. */
export function createPersistencePlugin(
  options: PluginOptions,
  resolveStorage = (strategy: PersistenceOptions): StorageLike | undefined =>
    strategy.storage ?? options.storage ?? defaultStorage()
): PiniaPlugin {
  return (context: PiniaPluginContext) => {
    const configured = context.options.persist ?? options.auto ?? false
    if (configured === false) return
    const configurations = (
      Array.isArray(configured) ? configured : [configured === true ? {} : configured]
    ) as readonly PersistenceOptions[]
    const strategies = configurations.map((configuration) => ({ configuration, key: undefined as string | undefined }))
    let hydrating = false

    function report(error: unknown, strategy: PersistenceOptions, phase: 'hydrate' | 'persist') {
      try {
        const callback =
          phase === 'hydrate'
            ? (strategy.onHydrateError ?? options.onHydrateError)
            : (strategy.onPersistError ?? options.onPersistError)
        callback?.(
          error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown persistence error'),
          context.store
        )
      } catch {
        // Error handlers must never interrupt the core mutation dispatcher.
      }
      try {
        if (strategy.debug ?? options.debug ?? false) {
          // Do not print the payload, thrown value, or serializer error message.
          console.error(`[pinia-react/persistedstate] Failed to ${phase} store "${context.id}".`)
        }
      } catch {
        // Custom console implementations and option accessors may throw too.
      }
    }

    function resolveKey(strategy: (typeof strategies)[number]): string {
      if (strategy.key !== undefined) return strategy.key
      const option = strategy.configuration.key ?? context.id
      const storeKey = typeof option === 'function' ? option(context.id) : option
      const key = options.key ? options.key(storeKey) : storeKey
      if (typeof key !== 'string') throw new TypeError('Persistence key must be a string')
      strategy.key = key
      return key
    }

    function hydrate({ runHooks = true }: HydrateOptions = {}) {
      // Nested calls share this round; do not resume writes before outer hooks finish.
      if (hydrating) return
      hydrating = true
      try {
        for (const strategy of strategies) {
          const config = strategy.configuration
          try {
            if (runHooks) (config.beforeHydrate ?? options.beforeHydrate)?.(context)
            const key = resolveKey(strategy)
            const storage = resolveStorage(config)
            if (storage) {
              const raw = storage.getItem(key)
              if (raw !== null) {
                const saved = (config.serializer ?? options.serializer ?? jsonSerializer).deserialize(raw)
                const selected = filterState(saved, config.pick, config.omit)
                context.restoreState(mergeState(context.store.$state, selected), { origin: ORIGIN })
              }
            }
            if (runHooks) (config.afterHydrate ?? options.afterHydrate)?.(context)
          } catch (error) {
            report(error, config, 'hydrate')
          }
        }
      } finally {
        hydrating = false
      }
    }

    function persist(state: unknown = context.store.$state) {
      for (const strategy of strategies) {
        const config = strategy.configuration
        try {
          const key = resolveKey(strategy)
          const storage = resolveStorage(config)
          if (!storage) continue
          const selected = filterState(state, config.pick, config.omit)
          const raw = (config.serializer ?? options.serializer ?? jsonSerializer).serialize(selected)
          if (typeof raw !== 'string') throw new TypeError('Serializer must return a string')
          storage.setItem(key, raw)
        } catch (error) {
          report(error, config, 'persist')
        }
      }
    }

    hydrate()
    if (strategies.length) {
      context.store.$subscribe((state, _previous, event) => {
        if (!hydrating && event?.meta.origin !== ORIGIN) persist(state)
      })
    }
    return { $hydrate: hydrate, $persist: () => persist() }
  }
}
