# @pinia-react/persistedstate

## 1.0.0

### Minor Changes

- 938ce4e: Add an explicit `@pinia-react/persistedstate/next` Cookie persistence entry for App Router preferences. Read allowlisted request cookies into a serializable snapshot and restore the same snapshot on the server and first client render, including lazy stores. Save later browser commits with configurable Cookie attributes, encoding and bounded writes; never write response cookies while rendering. Preserve filtering, ordered strategies, typed hooks and isolated errors, and document the supported integration in English and Chinese.

  Keep initial hydration snapshots and their Getter results separate from current live state so delayed Suspense consumers can hydrate correctly after another consumer commits a change, without rolling business state backwards.

- 938ce4e: Add the standalone persisted-state plugin with synchronous storage, global defaults, automatic opt-in, ordered strategies, safe nested filtering and merging, hydration hooks, isolated errors, and manual hydration/persistence APIs. Restore through controlled mutations without writing back during hydration. Support browser SPA, non-hook access, and DevTools integration while explicitly leaving full Next.js hydration adaptation for a separate design.

  Allow PiniaProvider to register initialization-only plugins before stores are created, without changing initial snapshots or rerender behavior.

  Preserve complete Store inference in store-level persistence hooks and error handlers, including Getter results and Action signatures. Export typed PersistenceContext and improve nested path suggestions without rejecting dynamic paths. Document the plugin in matching getting-started, configuration, advanced, TypeScript and limitations guides.

### Patch Changes

- Updated dependencies [938ce4e]
- Updated dependencies [938ce4e]
- Updated dependencies [68ffae6]
  - pinia-react@3.0.0
