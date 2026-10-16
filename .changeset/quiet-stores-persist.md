---
"pinia-react": minor
"@pinia-react/persistedstate": minor
---

Add the standalone persisted-state plugin with synchronous storage, global defaults, automatic opt-in, ordered strategies, safe nested filtering and merging, hydration hooks, isolated errors, and manual hydration/persistence APIs. Restore through controlled mutations without writing back during hydration. Support browser SPA, non-hook access, and DevTools integration while explicitly leaving full Next.js hydration adaptation for a separate design.

Allow PiniaProvider to register initialization-only plugins before stores are created, without changing initial snapshots or rerender behavior.

Preserve complete Store inference in store-level persistence hooks and error handlers, including Getter results and Action signatures. Export typed PersistenceContext and improve nested path suggestions without rejecting dynamic paths. Document the plugin in matching getting-started, configuration, advanced, TypeScript and limitations guides.
