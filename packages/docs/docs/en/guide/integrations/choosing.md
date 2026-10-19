# Choosing a state model

Start from the state owner rather than a feature checklist.

| Situation | Reasonable starting point |
| --- | --- |
| One form or transient UI | Local `useState` / `useReducer`; Context when descendants need the value |
| Existing Redux Toolkit and RTK Query application | Keep reducer, middleware, and server-cache conventions unless there is a concrete reason to migrate |
| Small shared state and explicit dependencies | Zustand creators and selectors |
| Related business domains and named derived values | Pinia-React options Stores, cached Getters, and Actions |
| SSR or multiple mounted applications | Request-local snapshots and scoped instances, regardless of library |
| Raw update overhead is critical | Measure the actual workload; Pinia-React's Immer and tracking have costs |

Context transports a value; it does not itself provide selective external-Store subscriptions. Redux middleware, Zustand middleware, and Pinia plugins are not interchangeable. See [Pinia-React and Zustand](./compare-zustand) for a focused comparison.

## Migrate one feature

1. Choose one business owner and preserve the UI contract. Leave local input and server-cache ownership alone.
2. Move one validated snapshot across the boundary. Pinia State is read-only; setters or reducer cases become Actions, and repeated derived values can become Getters.
3. Move side effects explicitly. Rebuild subscriptions, failure/retry behavior, and plugin integration; avoid dual writes between old and new Stores. Action failure does not roll back earlier writes.
4. For SSR, transfer request snapshots rather than global Stores. For external services, retain and pass the explicit Pinia before and after `await`; plain accessors do not read Context.
5. Remove the old feature subscription only after input, error, persistence, and hydration tests pass.

This costs call-site and test changes, snapshot validation, and ownership review. The [checkout example](./checkout-report) uses four Pinia Stores and one Zustand creator; that is an example convention, not proof of lower maintenance cost.

## Scope

Provider, synchronous persistence, and optional Redux DevTools remain separate topics. Setup Stores, a selector API, Store HMR, async persistence, cross-tab sync, automatic schema migrations, and a standalone diagnostics UI are not supported. Use [instance lifetime](../core-concepts/outside-component-usage) and [Action migration](./migration) for the actual runtime boundaries.
