---
"pinia-react": patch
"@pinia-react/persistedstate": minor
---

Add an explicit `@pinia-react/persistedstate/next` Cookie persistence entry for App Router preferences. Read allowlisted request cookies into a serializable snapshot and restore the same snapshot on the server and first client render, including lazy stores. Save later browser commits with configurable Cookie attributes, encoding and bounded writes; never write response cookies while rendering. Preserve filtering, ordered strategies, typed hooks and isolated errors, and document the supported integration in English and Chinese.

Keep initial hydration snapshots and their Getter results separate from current live state so delayed Suspense consumers can hydrate correctly after another consumer commits a change, without rolling business state backwards.
