# State

State is the core of a Store. It's a reactive object that contains the raw data that needs to be shared across your application.

**Key Concepts:**

*   **Reactivity:** The state is reactive. When data in the State changes, all components that depend on that data will automatically update their views.
*   **Immutability:** Under the hood, state modifications are handled by `immer`, which ensures that even though you write "mutating" code, the underlying state is updated immutably.

The state is defined as a function that returns the initial state object.

```tsx
import { defineStore } from 'pinia-react'

const { useStore } = defineStore('storeId', {
  // An arrow function is recommended for full type inference
  state: () => {
    return {
      count: 0,
      name: 'Eduardo',
      items: [],
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

const { useStore } = defineStore('storeId', {
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

const { useStore } = defineStore('storeId', {
  state: (): State => {
    return {
      userList: [],
      user: null,
    }
  },
})
```


## Accessing State

You can access the state directly through the store instance to read or write to it (within actions).

```tsx
const store = useStore()
console.log(store.count)
```

## Resetting State

You can reset the state to its initial value by calling the store's `$reset()` method.

```tsx
const store = useStore()
store.$reset()
```

## Changing State

While actions are the recommended way to change state, you can also use the `$patch` method. It's useful for modifying multiple properties at once.

```tsx
store.$patch({
  count: store.count + 1,
  name: 'DIO',
})
```

The `$patch` method also accepts a function for complex changes, such as array manipulations. This function receives a draft of the state that you can safely "mutate":

```tsx
store.$patch((state) => {
  state.items.push({ name: 'shoes', quantity: 1 })
})
```

## Replacing State

You cannot directly replace the `$state` object:

```tsx
// This will NOT work and will show a warning
store.$state = { count: 24 }
```

To replace the entire state, use `$patch` with the new state object:

```tsx
store.$patch({
  count: 24,
  name: 'Eduardo',
  items: []
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