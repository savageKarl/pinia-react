# Configuration

Put Store-specific options in `defineStore({ persist: ... })`. Register the default plugin or a [factory-created plugin](./advanced#global-defaults) before creating that Store.

## Enabling and disabling

| `persist` | Behavior |
| --- | --- |
| Omitted | Disabled, unless the factory has `auto: true` |
| `false` | Disabled, including under `auto: true`; no manual methods |
| `true` or `{}` | One strategy using the defaults |
| A configuration object | One customized strategy |
| An array of objects | Strategies run in array order |
| `[]` | Enabled but no strategies: manual methods are no-ops; no subscription |

## Option reference

A Store option overrides the same factory default; callbacks are replaced, not chained. `pick` / `omit` are strategy-only. The factory's `key` transform is applied **after** each strategy resolves its key, rather than being overridden by it.

| Option | Type | Default | Factory default? |
| --- | --- | --- | --- |
| `key` | `string \| (storeId: string) => string` | Store ID | Transform only; see [global keys](./advanced#global-keys) |
| `storage` | `StorageLike` | Browser `localStorage` | Yes |
| `serializer` | `Serializer` | `JSON.stringify` / `JSON.parse` | Yes |
| `pick` | `readonly string[]` with State-path suggestions | All State fields | No |
| `omit` | `readonly string[]` with State-path suggestions | Exclude nothing | No |
| `beforeHydrate` | `(context) => void` | None | Yes |
| `afterHydrate` | `(context) => void` | None | Yes |
| `onHydrateError` | `(error: Error, store) => void` | None | Yes |
| `onPersistError` | `(error: Error, store) => void` | None | Yes |
| `debug` | `boolean` | `false` | Yes |

`auto: boolean` belongs only to `createPersistedState`, and defaults to `false`. Store-level callbacks infer that Store's State, Getters and Actions; global callbacks remain generic. See [TypeScript](./typescript).

## key

By default, `defineStore('preferences', ...)` uses the `preferences` key. Set a fixed key or compute one from the Store ID:

```ts title="key.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const preferences = defineStore('preferences', {
  state: () => ({ theme: 'light' }),
  persist: { key: id => `my-app:${id}` }
})
```

The final key is `my-app:preferences` without a global transform. An empty string is a valid key. The resolved key is cached after success; this is not a reactive user/account switching mechanism. For account isolation, design explicit Store lifetimes and namespaces instead of capturing a changing user ID.

## storage

Use browser `sessionStorage` for tab-session lifetime instead of `localStorage`:

```ts title="session.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const draft = defineStore('draft', {
  state: () => ({ text: '' }),
  persist: { storage: sessionStorage }
})
```

This example is browser-only: accessing `sessionStorage` at module evaluation is your code's browser dependency. The plugin's own default storage is resolved lazily and safely without `window`.

Custom adapters need just **synchronous** `getItem` and `setItem`. Return `null` for a missing key; `removeItem` is not required:

```ts title="memory.ts"
import { createPinia } from 'pinia-react'
import { createPersistedState, type StorageLike } from '@pinia-react/persistedstate'

const values = new Map<string, string>()
export const memoryStorage: StorageLike = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => { values.set(key, value) }
}

createPinia().use(createPersistedState({ storage: memoryStorage }))
```

Memory storage is useful for tests or explicitly scoped non-browser applications; it does not survive a process restart. IndexedDB and async adapters are unsupported. See [storage limitations](./limitations#synchronous-storage-and-write-cost).

## serializer

A serializer receives a detached snapshot **after** field selection, not necessarily the complete State. Both methods must be synchronous; `serialize` must return a string and `deserialize` an object. For example, pretty-print JSON while keeping the same data format:

```ts title="serializer.ts"
import { defineStore } from 'pinia-react'
import { type Serializer } from '@pinia-react/persistedstate'

const readableJson: Serializer = {
  serialize: state => JSON.stringify(state, null, 2),
  deserialize: JSON.parse
}

export const appearance = defineStore('appearance', {
  state: () => ({ theme: 'light', temporaryPanel: false }),
  persist: { serializer: readableJson, pick: ['theme'] }
})
```

Only `{ theme: 'light' }` reaches `serialize`; the resulting JSON is indented. Do not mutate application state inside a serializer. Custom serialization does not add reactive support for arbitrary classes or guarantee business-schema validity; see [data limits](./limitations#serialization-and-data-shape).

## pick / omit

Paths use dot-separated **plain-object** properties. Arrays are whole fields: use `items`, not `items.0.name`. Getters and Actions are not State fields.

```ts title="selection.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const editor = defineStore('editor', {
  state: () => ({
    preferences: { theme: 'light', locale: 'en', preview: false },
    items: ['one', 'two'],
    dialogOpen: false
  }),
  persist: {
    pick: ['preferences', 'items'],
    omit: ['preferences.preview']
  }
})
```

The selected snapshot is:

```json
{"preferences":{"theme":"light","locale":"en"},"items":["one","two"]}
```

- `pick` runs first, then `omit`, on **both read and write**. Older stored fields excluded by today's selection do not restore.
- Omitting `pick` includes all State. `pick: []` selects an empty object. `omit: []` excludes nothing.
- A missing path is ignored; an empty segment or `__proto__`, `constructor`, `prototype` segment is rejected. Literal property names containing dots cannot be addressed.
- Restoration recursively merges plain objects, replaces arrays entirely, accepts `null` as an overwrite, and preserves unsaved defaults. It does **not** change core `$patch`'s shallow-merge behavior.

For example, factory state `{ preferences: { theme: 'light', locale: 'en' }, items: ['a'] }` and saved `{ preferences: { theme: 'dark' }, items: [] }` restore to `{ preferences: { theme: 'dark', locale: 'en' }, items: [] }`.

## beforeHydrate / afterHydrate

Each strategy runs `beforeHydrate → read → deserialize/filter/merge/restore → afterHydrate`. A missing key still runs both hooks. A failure skips that strategy's `afterHydrate` and reports a hydration error; later strategies continue.

```ts title="hooks.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const counter = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: { double: state => state.count * 2 },
  persist: {
    beforeHydrate({ store }) { console.info(`Restoring ${store.$id}`) },
    afterHydrate({ store }) { console.info(`Restored double: ${store.double}`) }
  }
})
```

Hooks are synchronous; returned Promises are not awaited. During initial hooks, the plugin's returned `$hydrate` / `$persist` methods are not installed yet. Use the supplied context; do not assume those methods are available. Write through Actions or `$patch`, never through the read-only `$state`.

Automatic writes remain paused until **all** strategies and hooks finish, including during manual hydration. Hook changes stay in memory until a later commit or explicit `$persist()`. See [lifecycle details](./advanced#restoration-and-write-isolation).

## Errors and debug

```ts title="errors.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const settings = defineStore('settings', {
  state: () => ({ theme: 'light' }),
  persist: {
    debug: true,
    onHydrateError(_error, store) { console.warn(`Could not restore ${store.$id}`) },
    onPersistError(_error, store) { console.warn(`Could not save ${store.$id}`) }
  }
})
```

Callbacks receive a normalized `Error` and the current Store. Errors in key resolution, storage access, serialization, validation or hooks are isolated per strategy; errors thrown by error callbacks are isolated too. A failed save does not roll back the business mutation. Debug output identifies only the operation and Store, not payloads or thrown messages. There is no fallback storage, automatic deletion, retry scheduler or schema migration. Avoid recursively saving from error handlers.
