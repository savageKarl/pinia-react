# Plugins

Pinia-React supports extending functionality through plugins. A plugin is a function that is applied to every store instance upon creation. You can:

- Add new properties or methods to stores.
- Wrap existing methods.
- Implement side effects, such as local storage persistence.
- Apply plugins only to specific stores.

Add a plugin to your Pinia instance using `pinia.use()`.

```ts
import { createPinia } from 'pinia-react'

// A simple plugin that adds a static property to every store.
function SecretPiniaPlugin() {
  return { secret: 'the cake is a lie' }
}

const pinia = createPinia()
pinia.use(SecretPiniaPlugin)

// In a component or another file...
const store = useStore()
console.log(store.secret) // 'the cake is a lie'
```

## Introduction

A Pinia plugin is a function that receives the store `context` as an argument and can optionally return an object of properties to add to the store.

```ts
export function myPiniaPlugin(context) {
  context.pinia // The pinia instance created with `createPinia()`.
  context.store // The store the plugin is augmenting.
  context.id    // The ID of the store.
  context.options // The options object passed to `defineStore()`.
}
```

## Extending the Store

You can add properties to every store by returning them from a plugin. These are merged into the store instance.

```ts
pinia.use(() => ({ hello: 'world' }))
```

You can also add properties directly on the `store` object within the plugin, which is useful for complex objects or functions that need access to the store itself.

```ts
pinia.use(({ store }) => {
  store.customMethod = () => {
    console.log(`Hello from ${store.$id}`)
  }
})
```

**Warning:** Plugins should **never** directly modify `store.$state`. Doing so will break reactivity and bypass developer tools. All state modifications must go through actions or `$patch`.

## Resetting Plugin-Added State

The built-in `$reset()` method only resets state defined in the `state()` function. If your plugin introduces state that needs to be reset, you must augment `$reset`.

Here's an example of a plugin that adds a `name` property and makes it resettable:

```ts
pinia.use(({ store, options }) => {
  // Add state from the initial options if provided
  if (options.state().name) {
    store.$state.name = options.state().name
  }

  // Augment the $reset method
  const originalReset = store.$reset.bind(store)

  return {
    $reset() {
      originalReset()
      // Also reset the plugin-added state to its initial value
      store.$patch({ name: options.state().name })
    },
  }
})
```

## Calling `$subscribe` in Plugins

You can use `store.$subscribe` within a plugin to react to state changes, for example, to implement local storage persistence.

```ts
pinia.use(({ store }) => {
  store.$subscribe((state) => {
    // Persist the state to localStorage
    localStorage.setItem(store.$id, JSON.stringify(state))
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

declare module 'pinia-react' {
  export interface PiniaCustomProperties {
    // Add your plugin's properties here
    secret: string;
    customMethod: () => void;
  }
}
```

Now you can access these properties on any store instance with full type support.