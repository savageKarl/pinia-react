# Actions

Actions are methods used to modify the **State**. They are where your business logic lives. Actions can be asynchronous and may contain API calls, complex calculations, and mutations to multiple state variables.

**Concept Explanation:**

*   **Business Logic:** Actions are the ideal place to centralize your business logic, keeping components clean.
*   **Asynchronous:** Actions can be `async` functions. You can `await` API calls or any other Promise inside them.
*   **State Mutations:** All state modifications should ideally happen within an action, making state changes predictable and trackable.

Define actions via the `actions` property in `defineStore()`.

```tsx
export const { useStore: useCounterStore } = defineStore('main', {
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

Inside an action, `this` refers to the store instance, giving you access to state, getters, and other actions with full type support.

Here's an example of an asynchronous action:

```tsx
import { mande } from 'mande';

const api = mande('/api/users');

export const { useStore: useUsersStore } = defineStore('users', {
  state: () => ({
    userData: null,
  }),

  actions: {
    async registerUser(login, password) {
      try {
        const response = await api.post({ login, password });
        this.userData = response;
        showTooltip(`Welcome back ${this.userData.name}!`);
      } catch (error) {
        showTooltip(error.message);
        return error;
      }
    },
  },
});
```

You can call actions just like any other method from your components:

```tsx
export function App() {
  const store = useCounterStore();
  
  return (
    <button onClick={() => store.randomizeCounter()}>Randomize</button>
  );
}
```

## Accessing Actions from Other Stores

To use another store's actions or state, simply get its instance within an action.

```tsx
import { getAuthStore } from './auth-store';

export const { useStore: useSettingsStore } = defineStore('settings', {
  state: () => ({
    preferences: null,
  }),
  actions: {
    async fetchUserPreferences() {
      const auth = getAuthStore();
      if (auth.isAuthenticated) {
        this.preferences = await fetchPreferences();
      } else {
        throw new Error('User must be authenticated');
      }
    },
  },
});
```