---
'pinia-react': major
---

Add a root PiniaProvider and the pinia-react/next client entry with lazy, complete per-store initialStores snapshots. Hooks prefer the Provider context, snapshots initialize before plugins, and server rendering does not activate a process-wide request store.

Actions now use a stable mutation proxy before and after await. Each real assignment commits independently against current state; nested and concurrent actions preserve one another's updates, and failed actions retain already committed writes. Array mutating methods commit once per call. Use $patch(fn) or the new shallow $patch(object) form to group writes into one commit.

Expose optional actionId and parentActionId mutation metadata and forward MutationEvent as the optional third $subscribe callback argument. Getter-only invalidation no longer invokes state subscriptions. JSON objects, arrays and primitive values are the supported reactive and serializable state model; Date, Map, Set and class mutation semantics are not guaranteed.
