---
'pinia-react': patch
---

Isolate Immer configuration, support special objects in state, and warn on store definition misuse.

- Use an isolated Immer instance so importing the library no longer disables auto-freeze for other Immer consumers.
- Preserve `Date`, `Map` and `Set` behaviour by only proxying plain objects and arrays.
- Warn when a store id is defined twice and replace the previous store with the new definition.
- Warn when a plugin is registered after stores were already created.
- Document the async `await` draft limitation and the unique store id rule.
