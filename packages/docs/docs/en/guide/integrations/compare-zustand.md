# Pinia-React and Zustand

Pinia-React organizes shared business state into State, Getters, and Actions, and tracks the paths a component reads. Zustand uses state creators and explicit selectors. These are different authoring models, not compatible APIs.

| Need | Pinia-React | Zustand |
| --- | --- | --- |
| Small shared values | Store structure may be more than needed | Often a direct fit |
| Business boundaries | Named State, cached Getters, and Actions | Application conventions and optional slices |
| Component dependencies | Automatic read-path tracking | Explicit selectors |
| Immutable changes | Immer built into Actions and function patches | Immutable updates, optional Immer middleware |
| SSR | Request snapshots and a scoped Provider | Request-scoped stores and React bindings |

Keep component-local state local. Use Pinia-React when its business structure is useful; choose Zustand when a small flexible primitive and explicit subscriptions fit better. Neither approach removes server validation or guarantees better total application performance.

## Run the examples

From the repository root:

~~~sh
pnpm install
pnpm playground-react
~~~

Open `#comparison` for the same count, profile, cart, and async updates. Render counters make subscription behavior visible; Strict Mode and other React work affect counts, so they are not speed scores.

Open `#checkout` for [one business workflow](./checkout-report) with the same form, request stub, and recovery rules. Pinia uses four business Stores; Zustand uses one vanilla creator. This is a valid small Zustand design, not a requirement to copy Pinia's structure. Optional persistence, DevTools, and Next.js integrations are demonstrations, not equivalent middleware comparisons.

See [choosing a state model](./choosing) for migration guidance.

For Zustand's API and SSR model, use its [React Store API](https://zustand.docs.pmnd.rs/reference/apis/create), [vanilla Store API](https://zustand.docs.pmnd.rs/reference/apis/create-store), and [Next.js guidance](https://zustand.docs.pmnd.rs/learn/guides/nextjs).
