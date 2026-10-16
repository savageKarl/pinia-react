# Advanced usage

## Global defaults

The default export is equivalent to `createPersistedState()` with no arguments. Use the factory to share defaults; register **one** of these plugins, not both.

```ts title="global.ts"
import { createPinia, defineStore } from 'pinia-react'
import { createPersistedState } from '@pinia-react/persistedstate'

const persistence = createPersistedState({
  storage: sessionStorage,
  debug: true,
  afterHydrate({ store }) { console.info(`Restored ${store.$id}`) }
})
createPinia().use(persistence)

export const preferences = defineStore('preferences', {
  state: () => ({ theme: 'light' }),
  persist: { debug: false } // Inherit storage and hook, override debug.
})
```

The explicit `sessionStorage` example is browser-only. A Store's hook/error callback replaces the corresponding global callback; they do not both run. `pick` and `omit` are deliberately configured per strategy, not as global defaults. See the [option table](./configuration#option-reference).

For a client-rendered Provider app, pass the factory result in `plugins={[persistence]}` instead of calling `createPinia().use(...)` separately. Provider plugin props are initialization-only; keep configuration stable for that Provider's lifetime.

## Automatic opt-in

```ts title="auto.ts"
import { createPinia, defineStore } from 'pinia-react'
import { createPersistedState } from '@pinia-react/persistedstate'

createPinia().use(createPersistedState({ auto: true }))

export const appearance = defineStore('appearance', {
  state: () => ({ theme: 'light' }) // Enabled by auto.
})
export const temporary = defineStore('temporary', {
  state: () => ({ search: '' }),
  persist: false // Explicit opt-out; no reads, writes or manual methods.
})
```

`auto` defaults to `false`. Prefer explicit opt-in or a narrow `pick` for Stores that contain transient or private fields. With `auto: true`, every Store without an explicit override persists its whole State.

## Global keys

The factory transforms the **resolved strategy key**, including custom strategy keys:

```ts title="keys.ts"
import { createPinia, defineStore } from 'pinia-react'
import { createPersistedState } from '@pinia-react/persistedstate'

createPinia().use(createPersistedState({ key: key => `app:${key}` }))
export const preferences = defineStore('preferences', {
  state: () => ({ theme: 'light' }),
  persist: { key: id => `${id}:appearance` }
})
```

The final key is `app:preferences:appearance`: Store ID → strategy key → global transform. Successful resolution is cached per strategy. In-memory Pinia isolation does not isolate external storage; use distinct keys if multiple instances should not share saved content.

## Multiple strategies

Use an array to split fields across storages, or intentionally layer saved values:

```ts title="strategies.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const workspace = defineStore('workspace', {
  state: () => ({ theme: 'light', locale: 'en', draft: '' }),
  persist: [
    { key: 'workspace:preferences', storage: localStorage, pick: ['theme', 'locale'] },
    { key: 'workspace:session', storage: sessionStorage, pick: ['theme', 'draft'] }
  ]
})
```

This browser-only example restores the first strategy, then the second. If local storage contains `{ "theme": "dark", "locale": "fr" }` and session storage contains `{ "theme": "light", "draft": "hello" }`, the final State is `{ theme: 'light', locale: 'fr', draft: 'hello' }`. Later successful strategies win on overlapping fields; missing fields retain the current value.

On saving, **each strategy** serializes its selection from the final current State in the same order. Identical storage/key pairs overwrite each other—the last successful write wins; they are not combined into one record. A failing strategy does not stop others or roll back earlier restoration. Use unique keys unless overwriting is intentional.

## Manual methods

```ts title="manual.ts"
import { createPinia, defineStore } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'

createPinia().use(persistedState)
const { getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  persist: true
})
const counter = getCounterStore()

counter.$persist?.() // Write all strategies now, without a mutation.
counter.$hydrate?.() // Restore all strategies, including hooks.
counter.$hydrate?.({ runHooks: false }) // Skip hooks, not error callbacks.
```

| Method | Contract |
| --- | --- |
| `$persist(): void` | Save strategies immediately; no state commit or subscription notification |
| `$hydrate(options?: HydrateOptions): void` | Read, validate, filter, merge and restore each strategy |
| `options.runHooks` | Defaults to `true`; `false` skips before/after hooks only |

Both methods are optional in TypeScript because disabled Stores and Stores created before registration do not have them. Use optional chaining or narrow before calling. `persist: []` installs no-op methods. Methods report failures through the configured error handlers; they do not return a success result.

## Restoration and write isolation

Initial creation and manual hydration use the same rules:

1. Pause automatic writes for this Store's entire restoration round.
2. Run each strategy and its hooks in order; each successful restore is a controlled mutation with origin `@pinia-react/persistedstate`.
3. Resume automatic saving in `finally`, even after a failure.

No strategy writes back before all initial strategies finish. Commits made by hooks or error callbacks during restoration are also excluded from automatic saving. A nested `$hydrate()` call during a round is ignored. A later business commit or explicit `$persist()` saves the current State; explicit persistence is not an automatic write and should not be called recursively from hooks.

This is write isolation, **not a transaction**: observers may see successive restored states, and an earlier successful restore remains after a later failure. Core State, Getter caches, subscriptions and React snapshots follow the normal mutation lifecycle. One Store's restoration does not pause another Store or Pinia instance.

## Reset is not deletion

An ordinary `$reset()` restores factory defaults and saves those defaults. It does **not** remove storage keys. To deliberately remove a Web Storage entry, do so in application code with the exact resolved key:

```ts title="remove.ts"
import { createPinia, defineStore } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'

createPinia().use(persistedState)
const { getSettingsStore } = defineStore('settings', {
  state: () => ({ theme: 'light' }),
  persist: { key: 'app:settings' }
})
const settings = getSettingsStore()

export function forgetSettings() {
  settings.$reset() // This writes defaults first.
  localStorage.removeItem('app:settings') // Browser-only, explicit application operation.
}
```

Handle `removeItem` failures in application code; they are outside the plugin's error callbacks. Remove after resetting, not before, because resetting writes again. The next committed change recreates the entry; `$hydrate()` on an absent key leaves current State unchanged. For multiple strategies, account for every storage and final transformed key. The plugin does not expose a clear/delete API.

## DevTools

DevTools time travel and DevTools reset are real commits and **update storage** by default. Persistence excludes only its own restore origin and the active restoration round, not all DevTools commits. Either plugin registration order works; the DevTools adapter filters its own messages to prevent protocol loops.

See [limitations](./limitations) before using persistence for large payloads, non-JSON values or server-rendered applications.
