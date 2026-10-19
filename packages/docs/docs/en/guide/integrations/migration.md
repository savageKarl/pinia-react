# Action runtime migration

The destructured defineStore API, named hooks and getters, createPinia(), and existing function patches remain available. New applications can use PiniaProvider; ordinary React applications may keep their activePinia setup.

| Behavior | Previous runtime | Current runtime |
| --- | --- | --- |
| Multiple synchronous assignments | Usually one action draft commit | One commit for each real assignment |
| Writes before and after await | Different draft lifetimes | One stable mutation proxy reading latest state |
| Nested actions | An outer draft could overwrite inner changes | Each action commits independently |
| Failed action | Synchronous draft changes could roll back | Already committed writes remain |
| Array mutators | Could expose draft lifecycle differences | One logical commit per method call |
| Subscriptions | Two state arguments | Optional third MutationEvent argument |

Use $patch(fn) to make several synchronous writes atomic, or $patch(object) for shallow top-level updates. A throwing patch recipe does not commit its own draft changes. Actions themselves provide no implicit transaction or asynchronous rollback; restore flags in finally or implement explicit business recovery.

Plugins and DevTools receive every real commit. Use optional actionId and parentActionId to correlate action events; do not rely on their string format. A patch inside an action still has type patch. Getter-only dependency invalidations do not call state subscriptions.

Plain objects and arrays are the supported reactive model. Special objects retain native reads for compatibility, but internal mutation is not tracked; replace whole values through Actions/patches or use plain data. SSR snapshots must be JSON-safe. See [Next.js App Router](./nextjs) for snapshots, root Provider lifetime and client-only getStore usage.

## Explicit instances and cleanup

Existing parameterless accessors remain available for single-root clients. With multiple instances, retain the Pinia at the application boundary and use `getStore(pinia)` in services before and after `await`. A supplied `PiniaProvider pinia={pinia}` reuses that instance; do not also pass Provider plugins or snapshots. Plain accessors do not read React Context, and Actions do not propagate an async instance context automatically.

The current core provides optional `context.onDispose` for plugins. Older hosts and hand-written contexts can omit it. Check the capability before acquiring resources, or retain a separate cleanup owner. The final application owner unmounts consumers before `disposePinia(pinia)`. Disposal is irreversible, does not delete persisted data, and is not automatic on Provider unmount. See [instance lifetime](../core-concepts/outside-component-usage) and [plugin cleanup](../plugins/index).
