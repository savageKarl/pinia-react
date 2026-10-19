---
'pinia-react': minor
---

Add opt-in development tracking diagnostics through onStoreDebug(pinia, listener) and optional string labels on generic and named Store Hooks. Value-free, immutable descriptions distinguish real source Mutations, committed dependency reads and matched onStoreChange requests; they do not equate notifications with React commits. Observer callbacks run after cache invalidation and business dispatch, retain per-Mutation provenance during nested writes, and cannot interrupt business dispatch when they throw. Production builds disable diagnostics and remove their allocation paths. Existing no-argument Hooks and Store names remain compatible.
