# Plugins

Pinia supports extending functionality through plugins. Here are some things you can extend:

- Add new properties to the store
- Add new methods to the store
- Wrap existing methods
- Modify or even cancel actions
- Implement side effects, such as local storage
- Apply plugins only to specific stores


Plugins are added to a Pinia instance via pinia.use(). The simplest example is adding a static property to all stores by returning an object.

```ts
import { createPinia } from 'pinia-react'

// Each created store will have a property named `secret` added to it.
// After installing this plugin, the plugin can be saved in different files
function SecretPiniaPlugin() {
  return { secret: 'the cake is a lie' }
}

const pinia = createPinia()
// Pass the plugin to Pinia
pinia.use(SecretPiniaPlugin)

// In another file
const store = useStore()
store.secret // 'the cake is a lie'
```

## Introduction

A Pinia plugin is a function that can optionally return properties to be added to the store. It receives an optional parameter, which is the context.

```tsx
export function myPiniaPlugin(context) {
  context.pinia // The pinia created with `createPinia()`. 
  context.store // The store that the plugin wants to extend
  context.options // The optional object that defines the store passed to `defineStore()`.
}
```

Then pass this function to pinia using pinia.use():

```ts
pinia.use(myPiniaPlugin)
```

## Extending the Store

You can add specific properties to each store directly by returning an object containing those properties in a plugin:

```ts
pinia.use(() => ({ hello: 'world' }))
```

You can also set the property directly on the store,

```ts
pinia.use(({ store }) => {
  store.hello = 'world'
})
```



### Adding New State 

If you want to add new state properties to the store, you must add them in two places at the same time.

- On the store, so you can access it with store.myState.
- On store.$state, so you can access it through store.$state.myState

```ts
pinia.use(({ store }) => {
  // eslint-disable-next-line no-prototype-builtins
  if (!Object.hasOwn(store.$state, 'pluginN')) {
    store.$state.pluginN = 20
  }
  store.pluginN = store.$state.pluginN
})
```

### Resetting Plugin-Added State

By default, $reset() does not reset state added by plugins, but you can override it to reset the state you added:

```ts
pinia.use(({ store }) => {
  // eslint-disable-next-line no-prototype-builtins
  if (!Object.hasOwn(store.$state, 'pluginN')) {
    store.$state.pluginN = 20
  }
  store.pluginN = store.$state.pluginN

  // Ensure context (`this`) is set to the store
  const originalReset = store.$reset.bind(store)

  // Override its $reset function
  return {
    $reset() {
      originalReset()
      store.pluginN = false
    },
  }
})
```

### Calling `$subscribe` in Plugins

You can also use store.$subscribe and store.$onAction in plugins.

```ts
pinia.use(({ store }) => {
  store.$subscribe(() => {
    // respond to store changes
  })
  store.$onAction(() => {
    // respond to store actions
  })
})
```

## TypeScript

All the above features have type support, so you never need to use any or @ts-ignore.

### Annotating Plugin Types 

A Pinia plugin can be type-annotated as follows:

```ts
import { PiniaPluginContext } from 'pinia-react'

export function myPiniaPlugin(context: PiniaPluginContext) {
  // ...
}
```

### Adding Types for New Store Properties

When adding new properties to the store, you should also extend the PiniaCustomProperties interface.

```ts
import 'pinia'

declare module 'pinia' {
  export interface PiniaCustomProperties {
    simpleNumber: number
  }
}
```

Then, you can safely write and read it:

```ts
pinia.use(({ store }) => {
  store.simpleNumber = Math.random()
})
```

### Adding Types for New State 

When adding new state properties (including to store and store.$state), you need to add types to PiniaCustomStateProperties. Unlike PiniaCustomProperties, it only receives the State generic:

```ts
import 'pinia'

declare module 'pinia' {
  export interface PiniaCustomStateProperties<S> {
    hello: string
  }
}
```