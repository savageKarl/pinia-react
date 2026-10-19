# Getters

Getters compute values from State or other Getters. Results are cached and recomputed when their dependencies change.

Define Getters in the `getters` option of `defineStore()`. The first argument is the current Store's `state`.

```tsx
export const { useCounterStore, getCounterStore } = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount: (state) => state.count * 2,
  },
})
```

## Accessing Other Getters

To use other getters within a getter, you can use a regular function and access other store properties via `this`. In TypeScript, you **must** explicitly define the return type for this to work.

```tsx
export const { useCounterStore, getCounterStore } = defineStore('counter', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubleCount(state) {
      return state.count * 2
    },
    // The return type **must** be explicitly set here
    doublePlusOne(): number {
      // Autocomplete and type annotation for `this` ✨
      return this.doubleCount + 1
    },
  },
})
```

Then you can directly access the getter on the store instance in your components:

```tsx
import React from 'react';
import { useCounterStore } from './counterStore';

export function CounterComponent() {
  const counter = useCounterStore();

  return (
    <p>Double count is {counter.doubleCount}</p>
  );
}
```

## Accessing Getters from Other Stores

Call the other Store's `getOtherStore()` inside a Getter, then read the property you need. Do not call a React Hook there. The generic `getStore()` alias is also available.

```tsx
import { getOtherStore } from './other-store'

export const { useMainStore, getMainStore } = defineStore('main', {
  state: () => ({
    localData: 'hello'
  }),
  getters: {
    combinedData(state): string {
      const otherStore = getOtherStore()
      return state.localData + ' ' + otherStore.data
    },
  },
})
```


## Cross-Store dependencies

During synchronous Getter evaluation, `getOtherStore()` uses the evaluating Store's Pinia, not global active Pinia. Keep the lookup inside the Getter rather than capturing a module-level Store. Explicitly passing another instance throws; cross-instance reactive Getter edges are not supported. Keep Getters synchronous and put async work in Actions.

Local Getter dependencies are tracked by read path. Cross-Store dependencies are tracked at Store level: a source change can invalidate a dependent Getter even if it changed an unread field. Invalidation propagates through chains such as `A → B Getter → C Getter` before subscribers are notified. Getter-only invalidation does not produce a business Mutation. Circular Getter evaluation warns and is not a supported way to compute values.

Component dependencies come from its committed render. Suspended or abandoned work does not replace the previous read set. Parents, props, Context, and other React work can still render a component independently of Store changes.

## Development diagnostics

~~~tsx
import { onStoreDebug } from 'pinia-react'

const stop = onStoreDebug(pinia, event => console.debug('store-debug', event))

function Summary() {
  const cart = useCartStore('Summary')
  return <output>{cart.total}</output>
}

// Stop the observer when diagnosis ends.
stop()
~~~

The optional string labels a Hook usage, not a discovered component. Give repeated readers distinct labels. Starting an observer does not force a render or replay history; labelled component events begin at the next committed render. No-argument Hooks remain supported.

| Event | Meaning |
| --- | --- |
| `mutation` | A real Store commit; one Action may commit more than once |
| `dependencies` | Paths and Getters read by a committed labelled render |
| `notify` | Store matching requested a reader update, not proof of a React commit |

Use React's Profiler separately to inspect commits. Store notifications may be batched, and these events do not explain every React render. Diagnostic callback errors are isolated, but business subscription errors still propagate; diagnostics are not a complete audit after an aborted notification.

Diagnostics are opt-in and disabled in production. Development builds must replace `process.env.NODE_ENV`; without an environment define or process global, diagnostics remain off. Events omit state snapshots, patch values, and Action arguments, but names, path keys, labels, and origins can still be sensitive. Keep them in a trusted local console.

Run `pnpm playground-react` and open `#diagnostics`. The existing example contrasts unread fields, dynamic paths, a cross-Store Getter, and a parent prop update. Enable Debug/Verbose console output to see `store-debug` separately from `react-commit`. There is no diagnostics panel to configure.
