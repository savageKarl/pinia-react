# Checkout example

Run the existing applications from the repository root:

~~~sh
pnpm playground-react
pnpm playground-nextjs
~~~

Open `#checkout` in the React playground or `/checkout` in the Next.js playground. This is one shared business flow, not a template for a commerce backend.

## What to try

- Quantity 4 exceeds stock and blocks purchase.
- Quantity 2 with delivery requires an address.
- A simulated request failure keeps stock at 3; retry succeeds with total **$29.00**, stock **1**, and shared cart quantity **2**.
- Duplicate pending submissions are ignored. Changing the selection while awaiting a request requires retry rather than reserving stale stock.

Pinia splits inventory, preferences, cart, and checkout into four Stores. Getters derive totals and eligibility; Actions own validation, pending/error state, and stock changes. A separate summary reads the same cart. Cross-Store Getters resolve their own instance; async business services retain explicit dependencies instead of relying on global active Pinia.

The Zustand counterpart uses one fresh vanilla creator, explicit derived reads, and immutable updates. Both share the same form, integer-cent prices, quantity limits, and synthetic submit request. Neither the four-Store split nor the single-creator shape is a requirement of the other library. The example illustrates business organization, not a performance ranking.

## Integration boundaries

Only the Pinia example demonstrates the existing persistence and DevTools plugins. SPA shipping persists to localStorage; Next shipping uses the allowlisted request Cookie adapter. This is not a head-to-head persistence, SSR, or middleware comparison.

Cookie `pick` filters restored and saved fields; it does not redact the raw allowlisted Cookie transported in RSC props. Do not put secrets or addresses in this demonstration Cookie. Production must validate inventory and orders server-side and implement request idempotency.

The root Provider retains client state across navigation and `router.refresh()`; a full reload rebuilds nonpersisted cart and inventory state. Provider unmount does not itself dispose resources. `onStoreDebug` is development-only; use the existing `#diagnostics` example for tracking, not production telemetry.

## Tests

Business tests exercise real Actions, failure/retry, shared state, instance isolation, persistence selection, and SSR snapshots. The existing browser probe covers the equivalent SPA inputs and Next request/hydration flow:

~~~sh
pnpm test:checkout:browser
~~~

Build the packages and both playgrounds, then start their production servers before running this probe. The script defaults to the React preview at `http://127.0.0.1:4173` and Next at `http://127.0.0.1:4174`. See [real Store testing](../core-concepts/testing) for test setup.
