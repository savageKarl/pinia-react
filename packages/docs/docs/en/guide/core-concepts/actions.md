# Actions

Actions change State and organize business logic. They can access the Store's State, Getters, and other Actions, and perform asynchronous requests or calculations.

Define methods in the `actions` option of `defineStore()` and write state through `this`. Components and ordinary business code cannot mutate public state directly; `$patch()` and `$reset()` are also available for batching and resetting changes.

```tsx
import { defineStore } from 'pinia-react'

export const { useCounterStore } = defineStore('counter', {
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

In a regular method, `this` refers to the current Store, with inferred types for State, Getters, and Actions.

You can call actions just like any other method from your components:

```tsx
export function App() {
  const store = useCounterStore();
  
  return (
    <button onClick={() => store.randomizeCounter()}>Randomize</button>
  );
}
```

Actions can use `async` / `await`. For example, wait one second before incrementing the count:

```tsx
import { defineStore } from 'pinia-react'

export const { useCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: {
    async incrementLater() {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000))
      this.count++
    },
  },
})
```

## Action commits and asynchronous work

### State before and after await

Actions use a stable mutation proxy. Reads and writes resolve the latest committed state before and after `await`. Nested references captured before an await remain usable:

```ts
actions: {
  async rename() {
    const profile = this.profile
    await save()
    profile.name = 'Ada'
  },
}
```

Concurrent Actions update the latest state, and nested Actions retain each other's changes. Actions preserve ordinary return values and Promise semantics without exposing an Immer Draft.

### Multiple writes and batching

Each ordinary assignment commits immediately and emits a `MutationEvent` if state changes. An Action that only reads state emits no event.

Use an explicit batch when several writes must commit together:

```ts
this.$patch((state) => {
  state.loading = false
  state.items.push(item)
})
this.$patch({ loading: false, error: null })
```

Both patch forms produce one commit when state changes and no event when it does not. Object patches replace the supplied top-level fields without deep merging. The array methods push, pop, shift, unshift, splice, sort, reverse, fill and copyWithin also commit once per call.

### Errors and rollback

If an Action throws or rejects, already committed changes remain. Handle cleanup explicitly with try/catch/finally. A throwing synchronous $patch recipe commits none of its draft changes. Drafts provided to $patch are valid only inside its synchronous callback; do not retain them across await.

### Action event metadata

Events from one Action share `meta.actionId`. Nested Actions receive their own ID and link to their parent through `meta.parentActionId`. Calls to `$patch()` and `$reset()` inside an Action keep their own event types and inherit Action metadata.

## Calling another Store

In a single-root client application, an Action can call a parameterless accessor after initialization. That accessor uses active Pinia, not the Action's instance. It is not a request-safe pattern when multiple instances can interleave.

For multi-instance work, accept the instance as an explicit business dependency and pass it to every lookup:

~~~ts
import { defineStore } from 'pinia-react'
import type { Pinia } from 'pinia-react'

const { getProgressStore } = defineStore('progress', {
  state: () => ({ completed: 0 }),
  actions: { step() { this.completed++ } },
})

export const { getJobStore } = defineStore('job', {
  state: () => ({}),
  actions: {
    async run(pinia: Pinia, task: Promise<void>) {
      getProgressStore(pinia).step()
      await task
      getProgressStore(pinia).step()
    },
  },
})

// Keep this Pinia at the application boundary; use the same instance on both sides.
// getJobStore(pinia).run(pinia, task)
~~~

Alternatively, close over the instance in an application-level service. There is no automatic async context propagation or temporary active-instance switching. Synchronous cross-Store Action nesting retains its existing metadata behavior, but calls after `await` do not gain an async parent link. Same-Store `this.inner()` calls retain their parent Action metadata after `await`.
