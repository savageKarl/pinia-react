## State

State is the core of a Store. It's a reactive object that contains all the raw data that needs to be shared across your application.

**Key Concepts:**

  * **Reactivity:** Pinia's State is built on Vue 3's `reactive` API. When data in the State changes, all components that depend on that data will automatically update their views.
  * **Flat Design:** Pinia recommends a flat State structure rather than deeply nested objects. For example, you should store user information and shopping cart information in separate Stores to improve readability and modularity.

In most cases, the **state** is the heart of your store. People usually start by defining the state that represents their app. In Pinia, the state is defined as a function that returns the initial state.

```tsx
import { defineStore } from 'pinia-react'

const useStore = defineStore('storeId', {
  // Arrow function is recommended for full type inference
  state: () => {
    return {
      // All these properties will have their types automatically inferred
      count: 0,
      name: 'Eduardo',
      isAdmin: true,
      items: [],
      hasChanged: true,
    }
  },
})
```

-----

## TypeScript

You don't need to do much to make your state TypeScript-compatible. As long as you have `strict` mode enabled, or at least `noImplicitThis`, Pinia will automatically infer your state types\! However, in some cases, you should help it with some conversions:

```tsx
const useStore = defineStore('storeId', {
  state: () => {
    return {
      // For initializing empty lists
      userList: [] as UserInfo[],
      // For data that hasn't been loaded yet
      user: null as UserInfo | null,
    }
  },
})

interface UserInfo {
  name: string
  age: number
}
```

If you prefer, you can define the state with an interface and add a type to the return value of `state()`.

```tsx
interface State {
  userList: UserInfo[]
  user: UserInfo | null
}

interface UserInfo {
  name: string
  age: number
}

const useStore = defineStore('storeId', {
  state: (): State => {
    return {
      userList: [],
      user: null,
    }
  },
})
```

-----

## Accessing State

By default, you can access the state through the store instance and read or write to it directly.

```tsx
const store = useStore()

store.count++
```

-----

## Resetting State

You can reset the state to its initial value by calling the store's `$reset()` method.

```tsx
const store = useStore()

store.$reset()
```

-----

## Changing State

Besides directly changing the store like `store.count++`, you can also use the `$patch` method. It allows you to change multiple properties at the same time with a state patch object:

```tsx
store.$patch({
  count: store.count + 1,
  age: 120,
  name: 'DIO',
})
```

However, some changes are difficult or expensive to implement with this syntax. Any collection modifications (like adding, removing, or splicing an element in an array) would require you to create a new collection. Therefore, the `$patch` method also accepts a function to group such changes that are difficult to implement with a patch object.

```tsx
store.$patch((state) => {
  state.items.push({ name: 'shoes', quantity: 1 })
  state.hasChanged = true
})
```

-----

## Replacing State

```tsx
// This doesn't actually replace `$state`
store.$state = { count: 24 }
// Internally calls `$patch()`:
store.$patch({ count: 24 })
```

-----

## Subscribing to State

You can listen for state changes using the store's `$subscribe()` method.

```tsx
cartStore.$subscribe((mutation, state) => {
  // import { MutationType } from 'pinia-react'
  mutation.type // 'direct' | 'patch object' | 'patch function'
  // same as cartStore.$id
  mutation.storeId // 'cart'
  // Only available if mutation.type === 'patch object'
  mutation.payload // The patch object passed to cartStore.$patch()

  // Persist the entire state to local storage whenever it changes.
  localStorage.setItem('cart', JSON.stringify(state))
})
```

-----

## Unsubscribing

By default, state subscriptions are bound to the component they were added in. This means they will be automatically removed when the component is unmounted. If you want to keep them even after the component is unmounted, pass `{ detached: true }` as the second argument to detach the state subscription from the current component:

```tsx
const someStore = useSomeStore()
// This subscriber will persist even after the component is unmounted
someStore.$subscribe(callback, { detached: true })
```