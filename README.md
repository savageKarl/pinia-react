# pinia-react

[](https://www.npmjs.com/package/pinia-react)
[](https://github.com/savageKarl/pinia-react/blob/main/LICENSE)

`pinia-react` is a state management library for React, inspired by Vue's Pinia. It is built upon Pinia's core logic and integrates seamlessly with React Hooks and `useSyncExternalStore` to deliver a concise, reactive, and TypeScript-friendly state management experience.

For more details, please refer to the [pinia-react documentation](https://savagekarl.github.io/pinia-react).

## Overview

### Motivation

Pinia is a highly acclaimed state management library in the Vue ecosystem, celebrated for its modular design and elegant API. `pinia-react` brings Pinia's core philosophy and parts of its implementation to the React ecosystem. By combining it with React Hooks and `useSyncExternalStore`, it offers a lightweight, intuitive, and TypeScript-friendly solution, especially suited for modern React projects that require reactive state management.

### Features

  - 🔄 **Pinia-Style Reactivity**: Built on Pinia's reactive core (from Vue 3's reactivity system), it automatically tracks state dependencies and updates only the necessary components.
  - ⚡️ **React Concurrent Rendering Support**: Ensures seamless compatibility with React 18's concurrent features through the use of `useSyncExternalStore`.
  - 🛠 **Modular Stores**: Adopts Pinia's modular design, supporting dynamic store registration, making it ideal for large-scale applications.
  - 🔍 **TypeScript Friendly**: Provides excellent type inference out-of-the-box, ensuring full type safety without extra configuration.
  - 🧩 **Plugin System**: Supports extensions like state persistence and logging, allowing for easy customization of store behavior.
  - 🔀 **Pinia API Compatibility**: Utilizes Pinia's API design, enabling a smooth transition for Vue developers and an easy learning curve for React developers.

## Quick Start

### Requirements

  - React 18+
  - ES6+

### Installation

```bash
pnpm add pinia-react
```

### Usage Example

```tsx
import { createPinia, defineStore } from 'pinia-react'
import { useEffect } from 'react'

// Initialize Pinia (API is identical to Pinia)
const pinia = createPinia();

// Define a store (using Pinia's defineStore API)
const useCounterStore = defineStore('counter', {
  // Define the initial state
  state: () => ({
    count: 0,
    name: 'Counter'
  }),
  
  // Define getters
  getters: {
    doubleCount() {
      return this.count * 2 // A Pinia-style getter
    }
  },
  
  // Define actions
  actions: {
    increment() {
      this.count++
    },
    
    async fetchSomething() {
      // Asynchronous operations are supported
      const result = await api.get('/data')
      this.count = result.count
    }
  }
})

// Use the store in a component
function Counter() {
  // Get the store instance
  const store = useCounterStore()
  
  useEffect(() => {
    // You can call actions
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

For more advanced usage, such as plugins or using the store outside of components, please see the [documentation](https://savagekarl.github.io/pinia-react).

## FAQ

### What is the relationship between `pinia-react` and Pinia?

`pinia-react` is an adaptation of Pinia for React. It is built upon parts of Pinia's core source code and has been optimized for the React ecosystem (for example, by using `useSyncExternalStore` to support concurrent rendering in React 18). We strictly adhere to Pinia's MIT License and have preserved the original author's copyright information in our license file.

### What are the advantages of `pinia-react` compared to Zustand or Redux?

`pinia-react` combines Pinia's modular architecture with React's Hooks API, offering a more streamlined API and superior TypeScript support. It is an excellent choice for modern React applications that benefit from a reactive state management paradigm.

## Acknowledgements

`pinia-react` is based on parts of the source code from [Pinia](https://github.com/vuejs/pinia), adapted and optimized for the React ecosystem. In compliance with the MIT License, we have retained the copyright notice of Pinia's original author and extend our sincere gratitude to the Pinia project and its creator. This project also draws inspiration from the design philosophy of [Zustand](https://github.com/pmndrs/zustand).

## License

This project is licensed under the [MIT License](https://github.com/savageKarl/pinia-react/blob/main/LICENSE). As `pinia-react` is derived from parts of Pinia's source code, it strictly complies with its MIT License requirements and preserves the original author's copyright information. Please see the license file for more details.