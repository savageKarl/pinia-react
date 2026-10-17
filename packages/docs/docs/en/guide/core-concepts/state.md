# State

State holds data shared by your application. Components subscribe to state read during rendering and update when that data changes.

Public state is read-only, including state returned to components and by `getStore()`. Change it through Actions, `$patch()`, or `$reset()`; Getters only read and compute values. Immer turns writes inside Actions and `$patch()` into immutable state updates.

Define a `state()` factory that returns the initial state. Prefer JSON-compatible strings, finite numbers, booleans, `null`, plain objects, and arrays. Reactive mutation and transfer are not guaranteed for `Date`, `Map`, `Set`, class instances, functions, Promises, or browser objects.

```tsx
import { defineStore } from 'pinia-react'

export const { useCounterStore, getCounterStore } = defineStore('counter', {
  // An arrow function is recommended for full type inference
  state: () => {
    return {
      count: 0,
      name: 'Eduardo',
      items: [] as { name: string; quantity: number }[],
    }
  },
})
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

Inside a React component or custom Hook, call `useCounterStore()`. Outside components, use `getCounterStore()` as described in [using Stores outside components](./outside-component-usage.mdx). The generic `useStore` and `getStore` aliases are also available.

```tsx
import { useCounterStore } from './stores/counter';

function MyComponent() {
  const store = useCounterStore();
  
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

Calling `$reset()` runs the `state()` factory again to restore its defaults, even if the Store was initialized from a server snapshot. It does not restore that snapshot.

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

You cannot directly replace the entire `$state` object. The following warns and also throws in strict mode:

```tsx
// This will NOT work
store.$state = { count: 24 }
```

Use `Object.assign()` inside `$patch()` to overwrite fields. It does not remove existing fields omitted from the new object:

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

## Mutation metadata

The optional third subscription argument is the committed event. Existing callbacks with two parameters remain valid:

```ts
store.$subscribe((state, prevState, event) => {
  console.log(event?.meta.type, event?.meta.origin, event?.meta.actionId)
})
```

Getter-only invalidation from another store updates dependent components without calling state subscriptions. The mutation event belongs to the store whose state actually changed.
