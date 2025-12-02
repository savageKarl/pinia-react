# State

State is the core of a Store. It's a reactive object that contains the raw data that needs to be shared across your application.

**Key Concepts:**

*   **Reactivity:** The state is reactive. When data in the State changes, all components that depend on that data will automatically update their views.
*   **Immutability:** Under the hood, state modifications are handled by `immer`, which ensures that even though you write "mutating" code, the underlying state is updated immutably.

The state is defined as a function that returns the initial state object.

```tsx
import { defineStore } from 'pinia-react'

const { useStore, getStore } = defineStore('storeId', {
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

const { useStore, getStore } = defineStore('storeId', {
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

const { useStore, getStore } = defineStore('storeId', {
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

Inside a React component or a custom hook, use the `useStore` hook to get the store instance.

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
defineStore('storeId', {
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
const store = useStore()
store.$reset()
```

## Changing State with `$patch`

While actions are the recommended way to change state, the `$patch` method is useful for batching multiple state mutations together.

The `$patch` method accepts a single function as its argument. This function receives a `draft` version of the state, powered by Immer. You can safely "mutate" this `draft` object, and Immer will produce a new immutable state for you.

```tsx
store.$patch((draft) => {
  draft.count++;
  draft.name = 'DIO';
  draft.items.push({ name: 'shoes', quantity: 1 });
})
```

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