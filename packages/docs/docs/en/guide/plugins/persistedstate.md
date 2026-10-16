# Persisted state

Keep selected state across page reloads with `@pinia-react/persistedstate`, a standalone synchronous persistence plugin for Pinia-React. Start with browser `localStorage` and JSON, then opt into the settings you need.

- Restore saved state when a Store is first created; save subsequent committed changes automatically.
- Choose fields with nested `pick` / `omit`, or split them across ordered storage strategies.
- Customize synchronous storage, serialization, hooks and error handling.
- Use the same plugin with React, non-Hook `getStore` and `PiniaProvider`.

:::warning Browser SPA first
The React setup below is for client-rendered applications. For server-rendered App Router pages, use the separate [Next.js Cookie adapter](./persistedstate/nextjs). The default localStorage plugin is not an SSR adapter. Never persist passwords or sensitive credentials.
:::

## Installation

Install the plugin alongside the core and your application's React dependencies:

```sh
pnpm add pinia-react @pinia-react/persistedstate
```

## 1. Enable persistence on a Store

```ts title="src/stores/settings.ts"
import { defineStore } from 'pinia-react'

export const { useSettingsStore, getSettingsStore } = defineStore('settings', {
  state: () => ({ theme: 'light', compact: false }),
  actions: {
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
    }
  },
  persist: true
})
```

## 2. Register before creating Stores

In a client-rendered React application, register the plugin on your Provider:

```tsx title="src/main.tsx"
import { createRoot } from 'react-dom/client'
import { PiniaProvider } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <PiniaProvider plugins={[persistedState]}>
    <App />
  </PiniaProvider>
)
```

Plugins register before the Provider creates Stores. `plugins` is **initialization-only**: rerendering does not register again or rehydrate. Keep the existing `initialStores` snapshot complete; plugin registration does not change its snapshot or instance-isolation rules. Do not register the same plugin twice.

## 3. Read and update as usual

```tsx title="src/App.tsx"
import { useSettingsStore } from './stores/settings'

export function App() {
  const settings = useSettingsStore()
  return (
    <button onClick={() => settings.toggleTheme()}>
      Theme: {settings.theme}
    </button>
  )
}
```

Click the button and reload. The `settings` storage key contains, for example:

```json
{"theme":"dark","compact":false}
```

Existing saved fields restore synchronously **before the first Store result** is returned. No saved key means factory defaults remain, without an initial write. Actions (including changes after `await`), both forms of `$patch`, `$reset` and DevTools commits trigger later saving. Getters themselves are not persisted.

## Without a Provider or Hook

Use this as an **alternative entry point**, not in addition to the Provider setup:

```ts title="src/non-hook.ts"
import { createPinia } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'
import { getSettingsStore } from './stores/settings'

createPinia().use(persistedState)
const settings = getSettingsStore()
settings.toggleTheme()
```

Register before calling `getStore` / `useStore`. Adding a plugin later does not retrofit existing Stores. Separate Pinia/Provider instances isolate memory, not a deliberately shared storage key.

## Choose your next step

| Goal | Read |
| --- | --- |
| Change the key, storage, serializer or selected fields | [Configuration](./persistedstate/configuration) |
| Set global defaults, use multiple strategies or save/restore manually | [Advanced usage](./persistedstate/advanced) |
| Understand completion, callbacks and extracted configurations | [TypeScript](./persistedstate/typescript) |
| Understand serialization, errors and server boundaries | [Limitations](./persistedstate/limitations) |

The guide organization is inspired by [pinia-plugin-persistedstate](https://praz.codeberg.page/pinia-plugin-persistedstate/guide/). Examples and behavior here follow Pinia-React's own contracts; Vue/Nuxt integrations are not part of this package.

For server-rendered preferences, read [Next.js: Cookie persistence](./persistedstate/nextjs).

## Try the API playgrounds

From the repository root, run `pnpm playground-react` for the default plugin/factory, selection, strategies, serializers, manual methods, hooks, errors and DevTools. Run `pnpm playground-nextjs` for Cookie snapshots, lazy Stores, explicit restore and a controllable delayed hydration boundary. Both show storage and an event journal; the scenario map is in `packages/playground/PERSISTENCE_DEMOS.md`.
