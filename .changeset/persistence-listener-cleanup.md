---
'@pinia-react/persistedstate': patch
---

Release persistence subscriptions on instance disposal, failed Store initialization and duplicate-ID replacement with lifecycle-enabled core. Reject captured hydrate and persist operations after their Store is closed, including Cookie persistence, without deleting stored data or performing a final write. Lifecycle failures remain visible rather than being reported as ordinary storage failures.

Older core contexts without onDispose retain their previous behavior and do not gain the complete disposal guarantee.
