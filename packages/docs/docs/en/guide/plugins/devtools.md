# DevTools

Pinia-React can connect stores to the [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools) through the optional `@pinia-react/devtools` package.

This integration is intentionally separate from the core package and opt-in per store. It is a Redux DevTools integration, not a Vue Devtools integration.

## Installation

Install the core library, the DevTools plugin, and the Redux DevTools browser extension:

```bash
pnpm add pinia-react
pnpm add -D @pinia-react/devtools
```

Register the plugin immediately after creating the Pinia instance. Plugins are applied when a store is first created, so registration must happen before calling a store hook or `getStore()` helper.

```ts title="src/pinia.ts"
import { createPinia } from 'pinia-react'
import { devtoolsPlugin } from '@pinia-react/devtools'

const pinia = createPinia()

if (import.meta.env.DEV) {
  pinia.use(devtoolsPlugin())
}

export { pinia }
```

The environment check is recommended for client-side applications, but it is not required for server rendering. The plugin does nothing when `window` or the Redux DevTools Extension is unavailable.

## Enabling a Store

Stores are not connected automatically. Add `devtools.enabled: true` to every store you want to inspect:

```ts title="src/stores/counter.ts"
import { defineStore } from 'pinia-react'

export const { useCounterStore, getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: {
    increment() {
      this.count++
    }
  },
  devtools: {
    enabled: true,
    name: 'Counter Store',
    trace: true
  }
})
```

`enabled` must be `true`. Omitting `devtools` leaves the store disconnected.

## Naming Connections

Each enabled store creates its own Redux DevTools connection. Use the plugin-level `name` to identify the application and the store-level `name` to identify the store:

```ts
pinia.use(devtoolsPlugin({ name: 'Admin' }))

defineStore('users', {
  state: () => ({ users: [] }),
  devtools: {
    enabled: true,
    name: 'Users'
  }
})
```

This connection appears as `Admin: Users`. Without custom names, the store ID is used.

## Supported Operations

The plugin sends the following committed mutations to Redux DevTools:

- Actions, using the action name and arguments.
- `$patch()` calls, including their Immer patches.
- `$reset()` calls.
- State restorations performed by plugins through the Pinia plugin API.

The current store state is initialized when the connection opens. From Redux DevTools, Pinia-React handles:

- Jump to state and jump to action.
- Rollback.
- Reset to the result of the store's `state()` function.
- Commit the current state as the new DevTools baseline.
- Import a Redux DevTools state history, restoring its final computed state.

State changes initiated by DevTools are not sent back as new mutations, which prevents feedback loops.

## Options

### Plugin options

| Option | Type | Description |
| --- | --- | --- |
| `name` | `string` | Application prefix used for every store connection. |

### Store options

| Option | Type | Description |
| --- | --- | --- |
| `enabled` | `true` | Explicitly connects this store. |
| `name` | `string` | Overrides the store ID in the connection name. |
| `trace` | `boolean` | Passes Redux DevTools action stack tracing through to the extension. |

## Current Limitations

The plugin does not provide Vue Devtools features such as a Pinia inspector, component-to-store inspection, or a Pinia-specific timeline. It also does not add in-app UI. All inspection and state-history controls live in the Redux DevTools Extension.
