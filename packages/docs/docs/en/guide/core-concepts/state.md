# State

State is the core of a Store. It's a reactive object that contains the raw data that needs to be shared across your application.

**Key Concepts:**

*   **Reactivity:** The state is reactive. When data in the State changes, all components that depend on that data will automatically update their views.
*   **Immutability:** Under the hood, state modifications are handled by `immer`, which ensures that even though you write "mutating" code, the underlying state is updated immutably.

The state is defined as a function that returns the initial state object.

```tsx
import { defineStore } from 'pinia-react'

const { useStore, getStore } = defineStore('counter', {
  // An arrow function is recommended for full type inference
  state: () => {
    return {
      count: 0,
      name: 'Eduardo',
      items: [],
    }
  },
})

export const useMyStore = useStore
export const getMyStore = getStore
```

## TypeScript

As long as you have TypeScript's `strict` mode enabled, Pinia-React will automatically infer your state types. However, you might need to help it with initial empty arrays or nullable objects:

```tsx
interface UserInfo {
  name: string
  age: number
}

const { useStore, getStore } = defineStore('counter', {
  state: () => {
    return {
      userList: [] as UserInfo[],
      user: null as UserInfo | null,
    }
  },
})
```

Alternatively, you can define the state with an interface and type the return value of `state()`:

```tsx
interface State {
  userList: UserInfo[]
  user: UserInfo | null
}

const { useStore, getStore } = defineStore('counter', {
  state: (): State => {
    return {
      userList: [],
      user: null,
    }
  },
})
```

## Accessing State

How you access state depends on the context:

### In React Components

Inside a React component or a custom hook, use the generated `useCounterStore` hook to get the store instance. The generic `useStore` helper is also available for backwards compatibility.

```tsx
import { useMyStore } from './stores/myStore';

function MyComponent() {
  const store = useMyStore();
  
  return <div>Count: {store.count}</div>;
}
```

### Within the Store (in actions or getters)

Inside a store's own actions or getters, use the `this` keyword to access state and other store properties.

```tsx
defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: {
    increment() {
      // Use `this` to access state
      this.count++;
    }
  }
})
```

## Resetting State

You can reset the state to its initial value by calling the store's `$reset()` method.

```tsx
const store = useCounterStore()
store.$reset()
```

## Changing State with `$patch`

While actions are the recommended way to change state, the `$patch` method is useful for batching multiple state mutations together.

The `$patch` method accepts a function or a shallow partial state object. This function receives a `draft` version of the state, powered by Immer. You can safely "mutate" this `draft` object, and Immer will produce a new immutable state for you.

```tsx
store.$patch((draft) => {
  draft.count++;
  draft.name = 'DIO';
  draft.items.push({ name: 'shoes', quantity: 1 });
})
```

Object patches shallowly replace top-level fields in one commit:

```ts
store.$patch({ count: 2, name: 'Ada' })
```

A nested object supplied in a patch must contain its complete replacement value. Both patch forms emit no mutation when state is unchanged. Keep function recipes synchronous and never retain their Immer draft.

## Replacing State

You cannot directly replace the entire `$state` object. The following will show a warning and will not work:

```tsx
// This will NOT work
store.$state = { count: 24 }
```

To achieve a "state replacement" effect, you can use `$patch` and assign the properties from your new state object to the draft. `Object.assign()` is a convenient way to do this.

```tsx
const newState = {
  count: 24,
  name: 'Eduardo',
  items: [{ name: 'shirt', quantity: 2 }]
};

store.$patch((draft) => {
  // This will overwrite the draft's properties with the ones from newState
  Object.assign(draft, newState);
})
```

## Subscribing to State

You can listen for state changes using the store's `$subscribe()` method. The callback receives the new state and the previous state as arguments. It returns a function to stop the subscription.

```tsx
const unsubscribe = cartStore.$subscribe((state, prevState) => {
  // Persist the entire state to local storage whenever it changes.
  localStorage.setItem('cart', JSON.stringify(state))
})

// To remove the listener, call the returned function
unsubscribe()
```

## Mutation metadata and serializable state

The optional third subscription argument is the committed event. Existing callbacks with two parameters remain valid:

```ts
store.$subscribe((state, prevState, event) => {
  console.log(event?.meta.type, event?.meta.origin, event?.meta.actionId)
})
```

Getter-only invalidation from another store updates dependent components without calling state subscriptions. The mutation event belongs to the store whose state actually changed.

Use JSON-compatible strings, finite numbers, booleans, null, plain objects and arrays for state. Reactive mutation and transport of Date, Map, Set, class instances, functions, Promise and browser objects are not guaranteed. Public state is read-only; use actions, $patch or $reset. $reset recreates the state factory defaults, including when the store originally received a server snapshot.
