---
'@pinia-react/devtools': patch
---

Release Store-owned Mutation and Redux DevTools subscriptions and the connection's own unsubscribe on instance disposal, failed Store initialization and duplicate-ID replacement. Register connection cleanup before initialization so an initialization error does not leak it. Ignore late and reentrant messages without disconnecting other instances or calling extension-wide disconnect.

Complete cleanup requires the lifecycle-enabled core. Older contexts without onDispose retain their existing runtime behavior.
