import { current, type Draft, isDraft } from 'immer'
import type { StatePath, StateTree } from './types'

export function isPlainObjectOrArray(value: unknown): value is object {
  if (Array.isArray(value)) return true
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function assertStateKey(key: string | symbol): asserts key is string {
  if (typeof key === 'symbol')
    throw new TypeError('[pinia-react] Symbol keys are not supported in Store state. Use string keys instead.')
}

export function assertStateValue(value: unknown, seen = new WeakSet<object>()): void {
  if (!isPlainObjectOrArray(value) || seen.has(value)) return
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    assertStateKey(key)
    assertStateValue(Reflect.get(value, key), seen)
  }
}

const warnedOpaqueValues = new WeakSet<object>()

export function warnIfOpaqueStateValue(value: unknown): void {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return
  if (isPlainObjectOrArray(value) || warnedOpaqueValues.has(value)) return
  warnedOpaqueValues.add(value)
  console.warn(
    '[pinia-react] Special state values are opaque. In-place mutation is not supported and will not emit patches, invalidate getters, or notify subscribers. Use plain data or replace the entire value through an Action or $patch().'
  )
}

// Guard function patches before Immer can copy or discard unsupported keys.
export function createStateWarningProxy<T extends object>(state: T): T {
  const proxies = new WeakMap<object, object>()
  const wrap = <U extends object>(target: U): U => {
    const proxy = new Proxy(target, {
      get(obj, key, receiver) {
        const value = Reflect.get(obj, key, receiver)
        if (!Object.hasOwn(obj, key)) return value
        if (isPlainObjectOrArray(value)) return proxies.get(value) ?? wrap(value)
        warnIfOpaqueStateValue(value)
        return value
      },
      set(obj, key, value) {
        assertStateKey(key)
        return Reflect.set(obj, key, unwrapStateValue(value))
      },
      deleteProperty(obj, key) {
        assertStateKey(key)
        return Reflect.deleteProperty(obj, key)
      },
      defineProperty(obj, key, descriptor) {
        assertStateKey(key)
        if ('value' in descriptor) assertStateValue(descriptor.value)
        return Reflect.defineProperty(obj, key, descriptor)
      },
      getOwnPropertyDescriptor(obj, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(obj, key)
        if (descriptor && 'value' in descriptor && isPlainObjectOrArray(descriptor.value)) {
          return { ...descriptor, value: proxies.get(descriptor.value) ?? wrap(descriptor.value) }
        }
        return descriptor
      }
    })
    proxies.set(target, proxy)
    return proxy
  }
  return wrap(state)
}

const proxyValues = new WeakMap<object, () => unknown>()

// Resolve action references before putting them into committed state or returning removed drafts.
export function unwrapStateValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  const read = proxyValues.get(value)
  if (read) return unwrapStateValue(read()) as T
  if (isDraft(value)) {
    assertStateValue(value)
    return current(value) as T
  }
  if (!isPlainObjectOrArray(value)) {
    warnIfOpaqueStateValue(value)
    return value
  }
  let copy: object | undefined
  for (const key of Reflect.ownKeys(value)) {
    assertStateKey(key)
    const original = Reflect.get(value, key)
    const resolved = unwrapStateValue(original)
    if (resolved !== original) {
      copy ??= Array.isArray(value) ? value.slice() : { ...value }
      Reflect.set(copy, key, resolved)
    }
  }
  return (copy ?? value) as T
}

const arrayMutators = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'])
const returnsArray = new Set(['sort', 'reverse', 'fill', 'copyWithin'])

export function createMutationProxy<S extends StateTree>(
  getState: () => S,
  commit: (updater: (draft: Draft<S>) => void) => void,
  rootGet: (key: PropertyKey) => unknown
): S {
  const atPath = (state: unknown, path: StatePath): any => {
    let value = state
    for (const key of path) value = Reflect.get(value as object, key)
    return value
  }
  const createProxy = (path: StatePath): any => {
    const proxies = new Map<PropertyKey, object>()
    const target = Array.isArray(atPath(getState(), path)) ? [] : {}
    const proxy: object = new Proxy(target, {
      get(_target, key, receiver) {
        const state = atPath(getState(), path)
        if (path.length === 0 && (key === '$state' || !Object.hasOwn(state, key))) return rootGet(key)
        if (Array.isArray(state) && typeof key === 'string' && arrayMutators.has(key)) {
          return (...args: unknown[]) => {
            let result: unknown
            commit((draft) => {
              const array = atPath(draft, path)
              const values = args.map(unwrapStateValue)
              if (key === 'sort' && typeof values[0] === 'function') {
                const compare = values[0]
                values[0] = (...items: unknown[]) => Reflect.apply(compare, undefined, items.map(unwrapStateValue))
              }
              result = Reflect.apply(Reflect.get(Array.prototype, key), array, values)
              if (!returnsArray.has(key)) result = unwrapStateValue(result)
            })
            return returnsArray.has(key) ? receiver : result
          }
        }
        const value = Reflect.get(state, key, receiver)
        if (typeof key === 'symbol') return value
        if (isPlainObjectOrArray(value)) {
          const child = proxies.get(key) ?? createProxy([...path, key])
          proxies.set(key, child)
          return child
        }
        if (Object.hasOwn(state, key)) warnIfOpaqueStateValue(value)
        return value
      },
      set(_target, key, value) {
        getState()
        assertStateKey(key)
        const resolved = unwrapStateValue(value)
        commit((draft) => {
          Reflect.set(atPath(draft, path), key, resolved)
        })
        return true
      },
      deleteProperty(_target, key) {
        getState()
        assertStateKey(key)
        commit((draft) => {
          Reflect.deleteProperty(atPath(draft, path), key)
        })
        return true
      },
      defineProperty(_target, key, descriptor) {
        getState()
        assertStateKey(key)
        if ('value' in descriptor) assertStateValue(descriptor.value)
        throw new TypeError(
          '[pinia-react] Object.defineProperty is not supported in Store Actions. Use assignment or $patch().'
        )
      },
      has(_target, key) {
        return Reflect.has(atPath(getState(), path), key)
      },
      ownKeys() {
        return Reflect.ownKeys(atPath(getState(), path))
      },
      getOwnPropertyDescriptor(_target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(atPath(getState(), path), key)
        if (!descriptor) return undefined
        if ('value' in descriptor && isPlainObjectOrArray(descriptor.value)) descriptor.value = Reflect.get(proxy, key)
        return { ...descriptor, configurable: key !== 'length' || !Array.isArray(target) }
      }
    })
    proxyValues.set(proxy, () => atPath(getState(), path))
    return proxy
  }
  return createProxy([])
}
