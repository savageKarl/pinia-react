# Limitations

Persistence is a convenience for small, serializable client preferences—not a database, a security boundary or a full SSR adapter. Understanding these limits avoids surprising reloads and inconsistent UI.

## Synchronous storage and write cost

The plugin restores during synchronous Store creation and saves on committed mutations. `getItem`, `setItem`, serializer methods and hooks must therefore be synchronous. IndexedDB, Promise-returning adapters and asynchronous hook work are not awaited and are not supported as persistence strategies.

Every real commit serializes and writes each enabled strategy; there is no built-in batching, debounce or retry scheduler. Large snapshots and expensive serializers block the committing thread. Save only necessary fields with `pick`, keep payloads small, and use a different application-level data layer for large or asynchronous datasets. An error does not roll back the successful in-memory mutation.

## Serialization and data shape

The default format is JSON. That is suitable for plain objects, arrays, strings, finite numbers, booleans and `null`, but not arbitrary JavaScript values:

| Value | What to expect / recommended representation |
| --- | --- |
| `Date` | JSON writes a string, not a restored `Date`; store an ISO string or timestamp |
| `Map`, `Set`, class instances | No guaranteed round trip; normalize to plain serializable data |
| `undefined`, functions, symbols | Not faithfully preserved by JSON; do not rely on them as saved State |
| `BigInt` | Default JSON serialization fails |
| `NaN`, infinity | JSON cannot preserve their numeric meaning; validate or normalize |
| Cyclic plain objects/arrays | Rejected; use IDs to represent relationships |
| Shared object references | Identity is not preserved across filtering/JSON/merge; normalize by IDs |

A custom serializer changes the format, not the core's supported reactive data model. In particular, do not assume converting a string to a class instance makes that instance deeply reactive.

### Dates as serializable state

Keep the persisted value simple and derive a `Date` for display/calculation:

```ts title="dates.ts"
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const reminder = defineStore('reminder', {
  state: () => ({ dueAt: '2026-10-15T09:00:00.000Z' }),
  getters: { dueDate: state => new Date(state.dueAt) },
  actions: { reschedule(iso: string) { this.dueAt = iso } },
  persist: { pick: ['dueAt'] }
})
```

Only `dueAt` is stored. Treat the derived `Date` as a computed value; update the string through an Action instead of mutating the Getter result. Validate incoming date strings according to your application needs.

### Validation is not a business schema

The plugin requires a plain-object payload, rejects dangerous keys (including those nested inside arrays) and rejects cyclic plain-object/array trees. This does **not** verify every field's expected type, remove every unknown field, or upgrade old business schemas. For example, stored `{ "count": "wrong" }` is still an object and can replace a numeric default.

Use a validating custom `deserialize` when your data requires a schema, and throw on invalid input. Keep `pick` narrow so unrelated old fields do not restore. There is no automatic migration or versioned schema system. The `Serializer` type describes a synchronous object-returning contract; it is not proof that external data is trustworthy.

## Security and storage failures

Browser storage is readable by application JavaScript and is not a secure credential vault. Do not persist passwords, sensitive credentials or highly sensitive personal data. The plugin does not encrypt data or manage authentication cookies. `omit` can help avoid accidental fields, but is not an access-control boundary; explicit `pick` is usually easier to audit.

Storage can fail because of quota, privacy restrictions or unavailable access. Corrupted JSON, throwing hooks and serializer failures can also occur. Set `onHydrateError` / `onPersistError` for application reporting and use `debug` during diagnosis. Error handlers themselves are isolated so they cannot interrupt other strategies or the core mutation dispatcher.

A failed read, deserialization or payload validation does not commit that payload. Hook mutations and already-successful restores remain, even if an after hook or a later strategy fails; restoration is not transactional. There is no automatic fallback, key deletion or background retry. Do not put state-changing retry loops in serializers or error handlers. Debug messages avoid payloads and thrown messages, but your own logging must still avoid sensitive data.

## Server rendering and Next.js

Importing the package does not access browser storage. Without `window`, operations using the default storage are skipped and the Store remains usable in memory. An explicitly supplied synchronous storage can still run on the server; its scope and isolation are the application's responsibility.

The default entry provides basic server safety; it does not reconcile browser-only localStorage with SSR snapshots. Do not register that SPA recipe on a server-rendered tree. For small server-visible preferences, the separate [Next.js Cookie adapter](./nextjs) restores the same request snapshot on both sides, preserves lazy-Store initialization, and supports delayed Suspense hydration. It does not add general localStorage SSR, authentication or Pages Router support.

## Instance and browser-tab boundaries

Separate Pinia/Provider instances isolate their in-memory state and subscriptions. They still share an external storage location if configured with the same key; choose namespaced keys when isolation is required.

Other tabs' writes do not automatically update an already-created Store. There is no `storage` event synchronization or conflict resolution. A later manual `$hydrate()` rereads storage using the documented restoration rules, but is not automatic cross-tab synchronization.

## Scope compared with the reference plugin

The familiar default plugin/factory, opt-in/`auto`, keys, synchronous storage/serializers, path selection, strategies, hooks and manual APIs are retained. React snapshots, controlled restore origins, whole-round automatic-write isolation, validation and optional method types follow Pinia-React's own contracts instead of copying Vue internals.

Vue setup-Store caveats, Vue HMR and Nuxt modules do not apply as features here. Async storage, cross-tab synchronization, TTL, migrations and encryption are not included. Cookies are available only through the explicit Next.js entry. See [advanced usage](./advanced) for behavior that **is** supported; the supported App Router Cookie path is documented separately in [Next.js](./nextjs).

## Final disposal

With lifecycle-enabled core, instance disposal and failed Store initialization remove persistence subscriptions. Captured `$persist` and `$hydrate` functions then throw, rather than writing through an obsolete Store. Local storage and cookies are retained; disposal does not perform a final write or delete saved data. Unmount dependent components before the owner calls `disposePinia`. Older core contexts without `onDispose` keep the prior behavior, not the complete disposal guarantee. Lifecycle errors are not converted into storage error callbacks.
