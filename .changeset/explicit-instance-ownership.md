---
'pinia-react': minor
---

Allow generic and named getStore accessors to receive an explicit Pinia instance, and allow PiniaProvider to receive an existing instance. Existing parameterless Store access and the extensible PiniaProviderProps interface remain supported. Use an explicit instance or a business closure for cross-Store Actions across await; this does not introduce automatic asynchronous context propagation.

Store ownership does not reserve a new business property name. Existing State, Getter, Action and plugin fields named $pinia remain valid.
