---
'pinia-react': patch
---

Support state mutations after `await` in async actions, make `$state` deeply readonly, and invalidate getters that return nested objects or arrays when their contents change.
