# What is Pinia-React?

Pinia-React manages shared React state with three parts:

- **State** holds data.
- **Getters** compute and cache derived values.
- **Actions** change State and organize business operations, including async work.

Components read a Store through a Hook. Read paths are tracked automatically so unrelated Store subscription updates can be filtered. Actions use Immer syntax for immutable updates, while public State remains read-only.

Use this structure when business domains and named derived values make your application easier to follow. For component-local state, start with `useState` or `useReducer`. Zustand offers a smaller, selector-driven model when you prefer explicit subscriptions and a flexible state creator. See [the comparison](../integrations/compare-zustand).

Automatic tracking adds runtime bookkeeping and does not prevent renders caused by parents, props, Context, or Strict Mode. It is not a promise of lower total rendering cost.

## Start small

Follow the [Quick Start](./getting-started) to initialize a browser app and define one Store. Then read [State](../core-concepts/state), [Getters](../core-concepts/getters), and [Actions](../core-concepts/actions).

Provider, multiple instances, SSR, and plugins are optional topics. Use [outside-component access](../core-concepts/outside-component-usage) when external services need an explicit instance, and [Next.js](../integrations/nextjs) for request snapshots. Persistence and Redux DevTools are separate packages.

## Boundaries

This is an options-Store API, not Vue Pinia compatibility. Setup Stores, a selector API, Store HMR, async persistence, cross-tab synchronization, and automatic schema migrations are not supported. Special objects retain native reads for compatibility but do not gain transparent reactive mutation; see [State](../core-concepts/state).
