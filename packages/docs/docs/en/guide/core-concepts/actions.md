# Actions

Actions are methods used to modify the **State**. They are the place in the Store where business logic is executed and can include asynchronous operations (such as API calls), complex calculations, and modifications to multiple State variables.

**Concept Explanation:**

  * **Single Entry Point for Modifications:** It's recommended to encapsulate all state modification operations in Actions. This makes the source of data modifications clear and visible, facilitating debugging and tracking.
  * **Synchronous and Asynchronous:** Actions support both synchronous and asynchronous operations. You can directly use `async/await` in Actions to handle asynchronous tasks, such as fetching data from a backend.
  * **Modularity:** Actions extract complex business logic from components, making components simpler and easier to maintain.

They can be defined through the `actions` property in `defineStore()` and are the perfect place for defining business logic.

```tsx
export const useCounterStore = defineStore('main', {
  state: () => ({
    count: 0,
  }),
  actions: {
    increment() {
      this.count++;
    },
    randomizeCounter() {
      this.count = Math.round(100 * Math.random());
    },
  },
});
```

Similar to getters, actions also have access to the entire store instance through `this` and support complete type annotations (as well as auto-completion ✨). The difference is that actions can be asynchronous; you can `await` any API calls and other actions inside them\! Here's an example using Mande. Note that it doesn't matter which library you use, as long as you get a Promise. You can even use the native `fetch` function (in browsers):

```tsx
import { mande } from 'mande';

const api = mande('/api/users');

export const useUsers = defineStore('users', {
  state: () => ({
    userData: null,
    // ...
  }),

  actions: {
    async registerUser(login, password) {
      try {
        this.userData = await api.post({ login, password });
        showTooltip(`Welcome back ${this.userData.name}!`);
      } catch (error) {
        showTooltip(error);
        // Let the form component display the error
        return error;
      }
    },
  },
});
```

You are also free to set any parameters you want and return any results. When calling an action, all types are automatically inferred.

Actions can be called like functions or regular methods:

```tsx
export function App() {

  const store = useCounterStore();
  // Call the action as a method of the store
  store.randomizeCounter();

  return (
    <button onClick={store.randomizeCounter}></button>
  );
}
```

-----

## Accessing Actions from Other Stores

To use another store, you can directly call it within an action:

```tsx
import { useAuthStore } from './auth-store';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    preferences: null,
    // ...
  }),
  actions: {
    async fetchUserPreferences() {
      const auth = useAuthStore.$getStore();
      if (auth.isAuthenticated) {
        this.preferences = await fetchPreferences();
      } else {
        throw new Error('User must be authenticated');
      }
    },
  },
});
```

-----

## Subscribing to Actions

You can listen to actions and their results through `store.$onAction()`. The callback function passed to it will be executed before the action itself. `'after'` means after the promise is resolved, allowing you to execute a callback function after the action is resolved. Similarly, `'onError'` allows you to execute a callback function when the action throws an error or rejects.

Here's an example that logs records before running the action and after the action resolves/rejects.

```tsx
const unsubscribe = someStore.$onAction(
  ({
    name, // action name
    store, // store instance, similar to `someStore`
    args, // array of parameters passed to the action
    after, // hook after the action returns or resolves
    onError, // hook when the action throws or rejects
  }) => {
    // Provide a shared variable for this specific action call
    const startTime = Date.now();
    // This will trigger before the action of "store" is executed.
    console.log(`Start "${name}" with params [${args.join(', ')}].`);

    // This will trigger after the action successfully runs.
    // It waits for any returned promise
    after((result) => {
      console.log(
        `Finished "${name}" after ${
          Date.now() - startTime
        }ms.\nResult: ${result}.`
      );
    });

    // This will trigger if the action throws or returns a rejected promise
    onError((error) => {
      console.warn(
        `Failed "${name}" after ${Date.now() - startTime}ms.\nError: ${error}.`
      );
    });
  }
);

// Manually remove the listener
unsubscribe();
```

By default, action subscribers are bound to the component they were added in. This means they will be automatically removed when the component is unmounted. If you want to keep them even after the component is unmounted, pass `true` as the second parameter to the action subscriber to detach it from the current component:

```tsx
import { useEffect } from 'react';

useEffect(() => {
  const someStore = useSomeStore();
  // This subscriber will persist even after the component is unmounted
  someStore.$onAction(callback, true);
});
```