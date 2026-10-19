---
'pinia-react': patch
---

Reject own symbol keys in plain-object and array business state, including nested and non-enumerable keys, instead of letting them bypass readonly protection or the normal mutation lifecycle. Initialization and state updates reject unsupported keys before the affected transition commits; string-keyed state and inherited array iteration remain supported.

Keep StatePath as string[] and MutationEvent patches compatible with Immer Patch[]. Block reflective writes through nested readonly state, preserve ordinary plugin metadata descriptors, and retain the documented warning-only boundary for opaque special values.

Applications that used symbol-keyed business state must rename those keys. Symbol keys are not silently removed or converted into strings.
