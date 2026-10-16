# Plugins

Pinia-React supports extending functionality through plugins. A plugin is a function that is applied to every store instance upon creation. You can:

- Add new properties or methods to stores.
- Augment existing methods like `$reset`.
- Implement side effects, such as logging or local storage persistence.

Add a plugin to your Pinia instance by calling `pinia.use()` in your application's entry point.

```ts
import { createPinia } from 'pinia-react'

// A simple plugin that adds a static property to every store.
function CreatedAtPlugin() {
  return { createdAt: new Date() }
}

const pinia = createPinia()
pinia.use(CreatedAtPlugin)

// In a component or another file...
// const store = useSomeStore()
// console.log(store.createdAt) // The date the store was created
```

## Introduction

A Pinia plugin is a function that receives a `context` object and can optionally return an object of properties to add to the store.

The context object exposes the store definition and its Pinia instance:

- `id`: The unique ID of the store (the first argument passed to `defineStore`).
- `store`: The store instance the plugin is augmenting.
- `options`: The options object that was passed to `defineStore()`.

```ts
export function myPiniaPlugin(context) {
  console.log(`Plugin applied to store: ${context.id}`)
  // context.store
  // context.options
}
```

## Extending the Store

You can add properties to every store by returning them from a plugin. These are merged into the store instance.

```ts
pinia.use(() => ({ hello: 'world' }))
```

You can also add properties directly on the `store` object, which is useful for complex objects or functions that need access to the store itself.

```ts
pinia.use(({ store }) => {
  store.customMethod = () => {
    console.log(`Hello from ${store.$id}`)
  }
})
```

**Warning:** Plugins should **never** directly modify `store.$state` (e.g., `store.$state.newProp = ...`). Doing so bypasses the reactivity system and will cause your UI to not update. All state modifications must go through actions or `$patch`.

## Augmenting `$reset`

The built-in `$reset()` method only resets state defined in the `state()` function. If a plugin adds its own properties to the store, you may want `$reset` to handle them as well. The correct way to do this is by augmenting (or "wrapping") the original `$reset` method.

Here is a safe example of a plugin that adds an `ephemeralCounter` property and a method to increment it. It then augments `$reset` to also reset this counter.

```ts
function EphemeralCounterPlugin({ store }) {
  // Add a new property directly to the store instance
  store.ephemeralCounter = 0

  // Augment the original $reset method
  const originalReset = store.$reset.bind(store)

  return {
    // Add a new method
    incrementEphemeral() {
      store.ephemeralCounter++
    },
    // Return a new, augmented $reset function
    $reset() {
      // Call the original reset logic first
      originalReset()
      // Then, reset the plugin's own property
      store.ephemeralCounter = 0
      console.log('Ephemeral counter was also reset.')
    },
  }
}

pinia.use(EphemeralCounterPlugin)
```

## Calling `$subscribe` in Plugins

Use `store.$subscribe` to observe committed state changes. For storage persistence, use [@pinia-react/persistedstate](./persistedstate), which handles filtering, safe merging, errors and hydration write isolation.

```ts
pinia.use(({ store }) => {
  store.$subscribe((state, previous, event) => {
    console.log(event?.meta.type, state, previous)
  })
})
```

## TypeScript

### Typing a Plugin

You can type a plugin's context for better type safety and autocompletion.

```ts
import { PiniaPluginContext } from 'pinia-react'

export function myPiniaPlugin(context: PiniaPluginContext) {
  // ...
}
```

### Typing New Store Properties

When you add new properties to a store via a plugin, you must also declare them globally in the `PiniaCustomProperties` interface for TypeScript to recognize them.

```ts
import 'pinia-react'

// Make sure this file is treated as a module.
export {}

declare module 'pinia-react' {
  export interface PiniaCustomProperties {
    // Add your plugin's properties here
    createdAt: Date;
    ephemeralCounter: number;
    incrementEphemeral: () => void;
  }
}
```

Now you can access these properties on any store instance with full type support.
## Initialization and mutation origins

Plugins run when each store is created. Factory defaults or a Provider's complete initialStores snapshot are already available in store.$state and pinia.state[id], and the store is registered in pinia._s. Register plugins before creating stores; registering later does not apply them to existing stores.

The context also contains pinia and the plugin-only restoreState function. Use restoreState to replace external state through the same commit lifecycle, preserving its origin:

```ts
pinia.use(({ restoreState }) => ({
  restoreFromSnapshot(snapshot) {
    restoreState(snapshot, { type: 'restore', origin: 'my-plugin' })
  }
}))
```

store.$subscribe((state, prevState, event) => {}) receives the same committed event as pinia.onMutation. Its optional metadata includes type, origin, action, actionId and parentActionId. Use origin to avoid sending a restore back to its source. Getter-only invalidation does not create a business mutation.

For a Provider, pass plugins through its initialization-only `plugins` prop, before stores are created. Persistence remains an independent plugin policy; see the [persisted state guide](./persistedstate). The core does not access storage or choose whether local data overrides initialStores. Basic server safety is not a complete Next.js hydration adapter.
