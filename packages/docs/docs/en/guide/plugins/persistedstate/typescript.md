# TypeScript

The package ships declarations and augments Pinia-React's Store options. A runtime import of the plugin loads the augmentation; a type-only import is enough in extracted configuration files. No application-wide `pinia.d.ts` or manual Store extension is needed.

## Inline callbacks infer the whole Store

Keep configuration inside `defineStore` for the best inference. State, Getter results and Action arguments/returns are available in hooks **and** error callbacks, including inside strategy arrays:

```ts title="counter.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const { getCounterStore, useCounterStore } = defineStore('counter', {
  state: () => ({ count: 0, preferences: { theme: 'light' } }),
  getters: { double: state => state.count * 2 },
  actions: {
    increment(amount: number) {
      this.count += amount
      return this.count
    }
  },
  persist: {
    pick: ['count', 'preferences.theme'],
    afterHydrate({ store, options }) {
      const doubled: number = store.double
      const factoryCount: number = options.state().count
      console.info(doubled, factoryCount)
    },
    onPersistError(error, store) {
      const retryAction: (amount: number) => number = store.increment
      console.warn(error.name, store.$id, typeof retryAction)
    }
  }
})
```

An editor suggests `count`, `preferences`, `double`, `increment` and the core Store members on `store.`. Nonexistent members and wrong Action arguments are type errors, rather than silently becoming `any`. The generated named aliases retain their ordinary inference. `$state` remains read-only.

The exported `PersistenceContext<State, StoreType>` describes a Store-level hook context. Its `store` is the complete inferred Store; its `options.state()` and plugin-only `restoreState` payload preserve State. `restoreState` is not a new application mutation API—use Actions and `$patch` in application code.

## Path suggestions are assistance, not schema validation

`StatePath<State>` suggests dot-separated plain-object paths for `pick` and `omit`:

- Optional/nullable nested fields and union members are included.
- Arrays and special objects such as `Date` are whole fields, not array indices/methods or instance-method paths.
- Recursive expansion is bounded to six path segments to keep editor work finite.
- Dangerous keys, empty keys and keys containing dots are not suggested.

Dynamic `string` paths are intentionally accepted. A misspelled path can therefore compile and be ignored at runtime if it does not exist. Type completion is **not strict path validation**, and neither TypeScript nor payload shape validation verifies your business schema. Broad dictionary types cannot enumerate unknown runtime keys. Persisting a `Date` field still requires an appropriate representation; completion does not imply round-trip or reactive support.

## Extract a State-only configuration

Use `PersistenceOptions<State>` when only State access is needed:

```ts title="extracted.ts"
import { defineStore } from 'pinia-react'
import type { PersistenceOptions } from '@pinia-react/persistedstate'

interface PreferencesState {
  theme: string
  compact: boolean
}
const persistence: PersistenceOptions<PreferencesState> = {
  pick: ['theme'],
  afterHydrate({ store }) {
    const theme: string = store.theme
    console.info(theme)
  }
}

export const preferences = defineStore('preferences', {
  state: (): PreferencesState => ({ theme: 'light', compact: false }),
  getters: { label: state => `${state.theme}:${state.compact}` },
  persist: persistence
})
const label: string = preferences.getStore().label
void label
```

The explicit State-only configuration does not know Getter/Action members inside its callbacks. It does **not** erase the Store's own Getter/Action inference.

For reusable configurations or helpers that already know a complete Store type, supply the second generic:

```ts title="typed-options.ts"
import type { PersistenceOptions } from '@pinia-react/persistedstate'
import type { getCounterStore } from './counter'

type CounterStore = ReturnType<typeof getCounterStore>
export const counterPersistence: PersistenceOptions<CounterStore['$state'], CounterStore> = {
  pick: ['preferences.theme'],
  afterHydrate({ store }) {
    const double: number = store.double
    console.info(double)
  },
  onPersistError(_error, store) {
    const increment: (amount: number) => number = store.increment
    console.warn(store.$id, typeof increment)
  }
}
```

This example derives from the previously defined `counter.ts`. Do not annotate a Store initializer using the return type of its **own not-yet-inferred definition**; that creates a circular type dependency. Prefer inline inference for that case.

## Global callbacks stay generic

A factory is shared by Stores with different shapes. It cannot infer one Store's Getter or Action names:

```ts title="global.ts"
import { createPersistedState, type PluginOptions } from '@pinia-react/persistedstate'

const options: PluginOptions = {
  afterHydrate({ store }) { console.info(store.$id) },
  onPersistError(error, store) { console.warn(error.name, store.$id) }
}
export const persistence = createPersistedState(options)
```

Use global callbacks for cross-Store behavior and metadata. Put shape-specific logic in the Store's own callbacks instead of asserting a global generic Store to one particular Store type.

## Optional manual methods

`$hydrate` / `$persist` are optional on the public Store type, even when `persist: true`. Module augmentation also applies to disabled Stores and Stores created without the plugin, so required methods would be an unsafe promise.

```ts title="methods.ts"
import { getCounterStore } from './counter'

const counter = getCounterStore()
counter.$hydrate?.({ runHooks: false })
counter.$persist?.()
if (counter.$persist) counter.$persist()
```

Do not use non-null assertions to hide missing plugin registration. Importing types enables configuration typing but does not install a runtime plugin; register one before Store creation as shown in [Getting started](../persistedstate).

## Public types

| Type | Purpose |
| --- | --- |
| `StorageLike` | Synchronous `getItem` / `setItem` adapter |
| `Serializer` | Synchronous snapshot serializer; its input is not necessarily the full State |
| `PersistenceOptions<S, StoreType>` | One strategy, with State-only or complete Store callbacks |
| `PersistenceContext<S, StoreType>` | Store-level hydration hook context |
| `Persist<S, StoreType>` | Boolean, strategy or readonly strategy-array union |
| `PluginOptions` | Factory defaults, global callbacks, `key` transform and `auto` |
| `HydrateOptions` | Manual hydration's `runHooks` option |
| `StatePath<S>` | Suggested State paths, not a strict validation schema |

## Next.js Cookie entry

`@pinia-react/persistedstate/next` exports `createCookiePersistedState`, `readCookieSnapshot`, `CookieSnapshot`, `CookieReader`, `CookieOptions` and `CookiePersistenceOptions`. It also loads the same Store option augmentation. Cookie factory options require an explicit request snapshot, provide Cookie attribute completion, and reject a different factory storage or HttpOnly option. Inline Store callbacks retain the inference shown above. See the complete [Next.js recipe](./nextjs).
