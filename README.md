
# React Pinia

Pinia-react is a state management library for React inspired by Vue's Pinia, bringing a clean, reactive, and TypeScript-friendly state management experience.

[](https://www.npmjs.com/package/pinia-react)
[](https://github.com/your-username/pinia-react/blob/main/LICENSE)

## Motivation

The React ecosystem has a variety of state management tools, but they can often be overly complex or lack structure. Inspired by Pinia's modular design and elegant API, pinia-react combines React Hooks with the Pinia philosophy to provide a lightweight, intuitive, and TypeScript-friendly state management solution suitable for modern React applications.

## Features

  - 🔄 **Powerful Reactivity** - Based on the Vue 3 reactivity system, it automatically tracks dependencies and efficiently updates components.
  - ⚡️ **Reactive** - Built on `useSyncExternalStore`, it perfectly adapts to React rendering.
  - 🛠 **Modular** - Independent stores that support dynamic loading.
  - 🔍 **TypeScript Friendly** - Automatic type inference with zero configuration.
  - 🧩 **Plugin System** - Flexible extensions for features like persistence and logging.
  - 🔀 **Familiar API** - The API design is fully inspired by Pinia, making it friendly for Vue developers.

## Installation

```bash
pnpm add pinia-react
```

## Basic Usage

### Creating and Using a Store

```tsx
import { defineStore } from 'pinia-react'
import { useEffect } from 'react'

// Define a store (API is identical to Pinia)
const useCounterStore = defineStore('counter', {
  // Define the initial state
  state: () => ({
    count: 0,
    name: 'Counter'
  }),
  
  // Define getter methods (similar to computed properties)
  getters: {
    doubleCount() {
      return this.count * 2
    }
  },
  
  // Define action methods
  actions: {
    increment() {
      this.count++
    },
    
    async fetchSomething() {
      // Supports asynchronous operations
      const result = await api.get('/data')
      this.count = result.count
    }
  }
})

// Use in a component
function Counter() {
  // Get the store instance
  const store = useCounterStore()
  
  useEffect(() => {
    // You can call an action method
    store.fetchSomething()
  }, [])
  
  return (
    <div>
      <h1>{store.name}: {store.count}</h1>
      <p>Double count: {store.doubleCount}</p>
      <button onClick={() => store.increment()}>Increment</button>
    </div>
  )
}
```

### Interacting Between Multiple Stores

```tsx
import { defineStore } from 'pinia-react'

// User Store
const useUserStore = defineStore('user', {
  state: () => ({
    name: 'Anonymous',
    isAdmin: false
  }),
  actions: {
    login(name, admin = false) {
      this.name = name
      this.isAdmin = admin
    },
    logout() {
      this.name = 'Anonymous'
      this.isAdmin = false
    }
  }
})

// Cart Store, which depends on the User Store
const useCartStore = defineStore('cart', {
  state: () => ({
    items: []
  }),
  getters: {
    isEmpty() {
      return this.items.length === 0
    },
    // Can use other stores
    isCheckoutAllowed() {
      const userStore = useUserStore.$getStore()
      return this.items.length > 0 && userStore.name !== 'Anonymous'
    }
  },
  actions: {
    addItem(item) {
      this.items.push(item)
    },
    checkout() {
      const userStore = useUserStore.$getStore()
      if (userStore.name === 'Anonymous') {
        throw new Error('Login required')
      }
      // Handle checkout logic...
      this.items = []
    }
  }
})
```

### Plugin System

Pinia-react supports extending functionality through plugins.

```ts
import { createpinia } from 'pinia-react'

// Create a pinia instance
const pinia = createpinia()

// Use a plugin
pinia.use(myPlugin)


// Plugin example
function myPlugin({ store, options }) {
  // Add custom properties or methods to the store
  return {
    customProperty: 'value',
    customMethod() {
      // Custom logic
    }
  }
}
```

## License

MIT