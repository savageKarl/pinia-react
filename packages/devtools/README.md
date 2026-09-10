# @pinia-react/devtools

Redux DevTools Extension integration for [pinia-react](https://www.npmjs.com/package/pinia-react).

## Installation

```bash
pnpm add pinia-react
pnpm add -D @pinia-react/devtools
```

Install the Redux DevTools Extension in your browser, then register the plugin before any store is created:

```ts
import { createPinia } from 'pinia-react'
import { devtoolsPlugin } from '@pinia-react/devtools'

const pinia = createPinia()

if (import.meta.env.DEV) {
  pinia.use(devtoolsPlugin())
}
```

Stores are opt-in. Enable each store that you want to inspect:

```ts
defineStore('app', {
  state: () => ({ count: 0 }),
  devtools: {
    enabled: true,
    name: 'Application',
    trace: true
  }
})
```

The plugin records actions, `$patch()` calls, `$reset()` calls, and plugin-driven state restorations. It supports Redux DevTools jump, rollback, reset, commit, and state import operations.

## Options

`devtoolsPlugin()` accepts an optional `name`, which prefixes every store connection:

```ts
pinia.use(devtoolsPlugin({ name: 'My App' }))
```

Each store accepts these `devtools` options:

| Option | Type | Description |
| --- | --- | --- |
| `enabled` | `true` | Connects the store to Redux DevTools. |
| `name` | `string` | Uses a custom store connection name instead of the store ID. |
| `trace` | `boolean` | Enables Redux DevTools action stack tracing. |

## Limitations

This package integrates with Redux DevTools, not Vue Devtools. It does not provide a Pinia inspector, component-to-store inspection, a Pinia-specific timeline, or an in-app interface.
