---
'pinia-react': minor
---

Add synchronous, irreversible and idempotent disposePinia(pinia), plus optional plugin-context onDispose(cleanup) registration. The core supplies this hook without requiring existing custom plugin hosts or hand-written contexts to add a new field. Provider unmount does not automatically dispose an instance; its final owner must unmount dependent trees before disposing it.

Disposal releases owned subscriptions, Getter dependencies, diagnostics and registered plugin resources, including resources belonging to replaced Store definitions. Captured operations reject use after explicit disposal. Duplicate-ID replacement keeps captured Store references usable without allowing their writes to overwrite the replacement's root snapshot.

Failed plugin initialization releases installation-owned resources and restores its initial snapshot for retry without removing successful nested Stores or unrelated application listeners. Cleanup continues after errors and reports an AggregateError; already completed business side effects are not rolled back.
