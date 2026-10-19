---
'pinia-react': patch
---

Fix stale cross-Store Getters in multi-hop chains and diamond-shaped dependencies. Invalidate all affected caches and update Store snapshots before notifying readers, including reentrant reads, without emitting derived business Mutations. Preserve the original Mutation source and forwarding path in development diagnostics.
