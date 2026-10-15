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

State uses JSON objects, arrays and primitive values as the supported reactive model. Represent Date, Map and Set as JSON data rather than relying on transparent mutation. See [Next.js App Router](./nextjs) for snapshots, root Provider lifetime and client-only getStore usage.
