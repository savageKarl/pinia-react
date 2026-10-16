# @pinia-react/persistedstate

Synchronous state persistence for `pinia-react`. No Vue or Nuxt dependency.

```sh
pnpm add pinia-react @pinia-react/persistedstate
```

```ts
import { createPinia, defineStore } from 'pinia-react'
import persistedState from '@pinia-react/persistedstate'

createPinia().use(persistedState)
export const { useSettingsStore, getSettingsStore } = defineStore('settings', {
  state: () => ({ theme: 'light' }),
  persist: true,
})
getSettingsStore().$persist?.()
```

Use `createPersistedState` for global defaults, `auto`, namespaced keys, custom synchronous storage/serializers and hooks. `persist` accepts booleans, one strategy or ordered strategies with nested `pick` / `omit`. `$hydrate({ runHooks })` and `$persist()` are optional methods, present on enabled stores. With a React SPA, pass `plugins={[persistedState]}` to `PiniaProvider`; plugin props are initialization-only.

Objects merge recursively, arrays replace entirely, null overwrites, and omitted fields remain. All strategies finish restoring before automatic write-back starts. Failures are isolated; ordinary resets and DevTools time travel update persistence. Only JSON-representable state is supported by default. No async storage, TTL, migrations or encryption. Cookie persistence is available through the separate Next.js entry.

Module import and default storage operations are safe without `window`. The default entry is for browser SPA use; server-rendered App Router preferences use the separate `@pinia-react/persistedstate/next` Cookie adapter. Do not store sensitive credentials.

[Full English guide](https://savagekarl.github.io/pinia-react/guide/plugins/persistedstate) · [中文指南](https://savagekarl.github.io/pinia-react/zh/guide/plugins/persistedstate)

## Documentation

- [Getting started](https://savagekarl.github.io/pinia-react/guide/plugins/persistedstate): browser SPA, Provider and non-Hook setup.
- [Configuration](https://savagekarl.github.io/pinia-react/guide/plugins/persistedstate/configuration): defaults, precedence and field selection.
- [Advanced usage](https://savagekarl.github.io/pinia-react/guide/plugins/persistedstate/advanced): global keys, ordered strategies and manual APIs.
- [TypeScript](https://savagekarl.github.io/pinia-react/guide/plugins/persistedstate/typescript): inferred hooks/errors, path completion and extracted options.
- [Limitations](https://savagekarl.github.io/pinia-react/guide/plugins/persistedstate/limitations): serialization, storage errors and SSR boundaries.
- [Next.js Cookie persistence](https://savagekarl.github.io/pinia-react/guide/plugins/persistedstate/nextjs): request snapshots, SSR hydration and browser writes.
