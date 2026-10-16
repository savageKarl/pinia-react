# Next.js: Cookie persistence

Use `@pinia-react/persistedstate/next` when small preferences must already be reflected in server-rendered HTML. The server reads an allowlisted Cookie snapshot, and the Client Provider restores **that same snapshot** before any Store is returned. It does not read a newer browser Cookie during initial hydration.

This entry supports Next.js App Router with a root Provider. It does not add automatic SSR support to the default `localStorage` plugin. Keep larger drafts in another storage layer; browser-readable cookies are not suitable for credentials.

## 1. Choose the final Cookie keys

Keep names in a shared module with no request data. These are **final** keys, after any Store key function and global key transform:

```ts title="app/persistence.ts"
export const preferenceCookieKeys = ['app:preferences'] as const
```

## 2. Create the plugin inside a Client Provider

```tsx title="app/providers.tsx"
'use client'

import type { ReactNode } from 'react'
import { PiniaProvider } from 'pinia-react/next'
import { createCookiePersistedState, type CookieSnapshot } from '@pinia-react/persistedstate/next'

export function Providers({ children, cookies }: { children: ReactNode; cookies: CookieSnapshot }) {
  const persistence = createCookiePersistedState({
    cookies,
    cookieOptions: { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 }
  })
  return <PiniaProvider plugins={[persistence]}>{children}</PiniaProvider>
}
```

The plugin closes over a copy of this request's snapshot. Provider props are initialization-only: rerendering does not install another plugin or reapply cookies. Create it inside this boundary, not as a process-global plugin holding request data. Functions stay in the Client Component; only plain serialized data crosses from server to client.

## 3. Read the request in the Server Layout

```tsx title="app/layout.tsx"
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { readCookieSnapshot } from '@pinia-react/persistedstate/next'
import { preferenceCookieKeys } from './persistence'
import { Providers } from './providers'

export default async function Layout({ children }: { children: ReactNode }) {
  const snapshot = readCookieSnapshot(await cookies(), preferenceCookieKeys)
  return (
    <html lang='en'>
      <body><Providers cookies={snapshot}>{children}</Providers></body>
    </html>
  )
}
```

Next.js's `cookies()` is awaited here, outside Store creation. Reading request cookies makes this route request-dependent; account for your Next.js caching and rendering rules. `readCookieSnapshot` calls `get` only for the encoded allowlisted names, and keeps values **already decoded by Next.js** unchanged. Do not decode them again: literal text such as `%20` must survive.

Never pass all request cookies into a Client Component: that could expose unrelated credentials, including HttpOnly cookies read by server code. This helper deliberately requires an explicit list of preference keys. If the reader throws, handle that at your server boundary; strategy error callbacks begin when a Store is created.

## 4. Enable the Store

```tsx title="app/preferences.tsx"
'use client'

import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate/next'

export const { usePreferencesStore } = defineStore('preferences', {
  state: () => ({ theme: 'light', locale: 'en' }),
  getters: { label: state => `${state.theme}:${state.locale}` },
  actions: {
    toggleTheme() { this.theme = this.theme === 'light' ? 'dark' : 'light' }
  },
  persist: { key: 'app:preferences', pick: ['theme', 'locale'] }
})

export function Preferences() {
  const preferences = usePreferencesStore()
  return <button onClick={() => preferences.toggleTheme()}>{preferences.label}</button>
}
```

Render `Preferences` in a page beneath the layout. Toggle the theme, then reload: the server HTML already uses the saved theme, and the first client render agrees. There is no effect-based default-theme-to-saved-theme transition.

## Snapshot and lifetime rules

| Operation | Behavior |
| --- | --- |
| Initial server/client Store creation | Restore from the supplied request snapshot only |
| Missing key, including omitted allowlist entry | Keep current defaults/initialStores; do not read newer browser data |
| `initialStores` plus Cookie data | Start with the existing complete initialStores snapshot, then filter/merge Cookie fields through the plugin |
| Lazy Store created later | Still use the Provider's captured snapshot for its first restoration |
| Browser Action, `$patch`, `$reset`, DevTools commit | Save selected fields to browser cookies |
| `$persist()` in browser | Save immediately; normal errors/size limits apply |
| `$hydrate()` in browser | Explicitly reread current browser cookies; intended for events/effects after that consumer has hydrated |
| Server-side save | No response write; in-memory business mutations remain valid |
| Server-side `$hydrate()` | Reread the captured request snapshot |
| Navigation / `router.refresh()` under the same Provider | Keep existing instance and client changes; new props do not replay request data |
| Full reload or Provider remount | New instance, new supplied snapshot |

Initial restoration retains the generic plugin's strategy ordering, hooks, safe payload checks, recursive object merge, array replacement, `null` overwrite and whole-round write isolation. No initial Cookie write occurs. Reading an older hydration snapshot never commits it backwards or overwrites a user's new action. Delayed Suspense consumers use their initial render snapshot and then catch up to current State/Getters.

For lazy Stores not present in the request allowlist, defaults are intentional. Predeclare keys for all SSR-persisted Stores. Changing accounts requires an explicit Provider lifetime boundary; ordinary refresh does not replace an active user's state. Supply deterministic factory defaults and identical initialStores to server/client; this adapter cannot reconcile arbitrary time-dependent initial state.

## Factory and Cookie options

`createCookiePersistedState(options): PiniaPlugin` requires `cookies: CookieSnapshot`. It accepts the generic factory's `auto`, global `key`, `serializer`, `debug`, hooks and error handlers. Store `persist` still accepts booleans, a configuration or ordered arrays, with State/Getter/Action inference. Global and per-strategy keys follow the [same composition](./advanced#global-keys).

It is a **Cookie-only** plugin. Factory `storage` is not a type option, and a per-strategy `storage` override reports a strategy error without using that storage. Do not register it alongside the default persistence plugin on the same Store; that would create two independent persistence lifecycles. LocalStorage/async strategies require a different explicitly designed SSR integration.

| `cookieOptions` | Default | Meaning |
| --- | --- | --- |
| `path?: string` | `/` | Visibility path; use `/` to share across pages |
| `domain?: string` | Omitted | Host-only cookie; explicit Domain must be valid for the host |
| `maxAge?: number` | Omitted | Session cookie; nonnegative safe integer seconds, `0` expires it |
| `sameSite?: 'lax' \| 'strict' \| 'none'` | `'lax'` | `none` requires Secure |
| `secure?: boolean` | `true` on HTTPS, otherwise `false` | Send only over HTTPS when enabled |

Cookie keys and values are URI-encoded once on browser writes. `readCookieSnapshot` selects the corresponding encoded names; its returned record uses logical unencoded keys. An empty key is invalid for Cookie persistence. `__Secure-` and `__Host-` prefix constraints are enforced. HttpOnly cannot be configured because these preferences must be writable by browser JavaScript.

Assignments exceeding **4096 encoded bytes including attributes** are rejected through `onPersistError`, without reverting the Store mutation. Keep fields small; browsers can still silently reject cookies because of domain, policy, total quota or access restrictions. A successful setter call cannot prove durable storage. Use the same Path/Domain if the server later updates a cookie, and avoid duplicate same-name cookies at different paths.

## Server changes and scope

Rendering a Server Component never writes response cookies through this plugin. Server-side changes must use Next.js's own allowed write boundary (Server Action/Route Handler); if you do that, write the exact encoded Cookie name with the serialized value and matching attributes, and explicitly decide whether the current Provider should be remounted or updated. `router.refresh()` alone does not reinitialize it.

This is a preference-persistence adapter, not authentication/session management, localStorage hydration support, Pages Router integration, migration, cross-tab synchronization or an automatic Cookie-to-server mutation bridge. Validate business data in `deserialize`; client-controlled cookies are untrusted. See [limitations](./limitations) and [configuration](./configuration) for the unchanged generic behavior.
