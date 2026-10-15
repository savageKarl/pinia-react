import { current, type Draft, isDraft } from 'immer'
import type { StatePath, StateTree } from './types'

export function isPlainObjectOrArray(value: unknown): value is object {
  if (Array.isArray(value)) return true
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const proxyValues = new WeakMap<object, () => unknown>()

// Resolve action references before putting them into committed state or returning removed drafts.
export function unwrapStateValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  const read = proxyValues.get(value)
  if (read) return read() as T
  if (isDraft(value)) return current(value) as T
  if (!isPlainObjectOrArray(value)) return value
  let copy: object | undefined
  for (const key of Object.keys(value)) {
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
  const proxies = new Map<string, object>()
  const createProxy = (path: StatePath): any => {
    const cacheKey = JSON.stringify(path)
    const cached = proxies.get(cacheKey)
    if (cached) return cached
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
        if (typeof key === 'string' && isPlainObjectOrArray(value)) return createProxy([...path, key])
        return value
      },
      set(_target, key, value) {
        const resolved = unwrapStateValue(value)
        commit((draft) => {
          Reflect.set(atPath(draft, path), key, resolved)
        })
        return true
      },
      deleteProperty(_target, key) {
        commit((draft) => {
          Reflect.deleteProperty(atPath(draft, path), key)
        })
        return true
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
        return { ...descriptor, configurable: key !== 'length' || !Array.isArray(target) }
      }
    })
    proxies.set(cacheKey, proxy)
    proxyValues.set(proxy, () => atPath(getState(), path))
    return proxy
  }
  return createProxy([])
}
