import { isReactive, isRef } from '@maoism/runtime-core'
import { isArray, isObject, isUndefined } from 'savage-types'
import { copyDeep } from 'savage-utils'

import type { _DeepPartial, StateTree } from './types'

export function reactiveMerge<T extends object>(x: T, y: T, clear = false) {
  if (clear) {
    const xKey = Object.keys(x)
    const yKey = Object.keys(y)

    const deleteKeys = xKey.filter((k) => !yKey.includes(k))
    deleteKeys.forEach((k) => Reflect.deleteProperty(x, k))
  }

  for (const k in y) {
    const xValue = x[k]
    const yValue = y[k]

    if (xValue === yValue) continue

    if (isObject(yValue) && isObject(xValue)) {
      reactiveMerge(xValue, yValue, clear)
    } else if (isArray(yValue)) {
      if (isUndefined(xValue)) x[k] = [] as T[Extract<keyof T, string>]
      // @ts-ignore
      x[k].length = yValue.length
      yValue.forEach((_, k2) => {
        // @ts-ignore
        x[k][k2] = yValue[k2]
      })
    } else {
      x[k] = copyDeep(y[k] as object) as T[Extract<keyof T, string>]
    }
  }
}

export function noop() {
  return {}
}

export function isPlainObject<S extends StateTree>(value: S | unknown): value is S
export function isPlainObject(o: any): o is StateTree {
  return (
    o &&
    typeof o === 'object' &&
    Object.prototype.toString.call(o) === '[object Object]' &&
    typeof o.toJSON !== 'function'
  )
}

export function mergeReactiveObjects<T extends Record<any, unknown> | Map<unknown, unknown> | Set<unknown>>(
  target: T,
  patchToApply: _DeepPartial<T>
): T {
  // Handle Map instances
  if (target instanceof Map && patchToApply instanceof Map) {
    patchToApply.forEach((value, key) => target.set(key, value))
  }
  // Handle Set instances
  if (target instanceof Set && patchToApply instanceof Set) {
    patchToApply.forEach(target.add, target)
  }

  // no need to go through symbols because they cannot be serialized anyway
  for (const key in patchToApply) {
    // eslint-disable-next-line no-prototype-builtins
    if (!Object.hasOwn(patchToApply, key)) continue
    const subPatch = patchToApply[key]
    const targetValue = target[key]
    if (
      isPlainObject(targetValue) &&
      isPlainObject(subPatch) &&
      // biome-ignore lint/suspicious/noPrototypeBuiltins: <>
      target.hasOwnProperty(key) &&
      !isRef(subPatch) &&
      !isReactive(subPatch)
    ) {
      // @ts-ignore
      target[key] = mergeReactiveObjects(targetValue, subPatch)
    } else {
      // @ts-expect-error: subPatch is a valid value
      target[key] = subPatch
    }
  }

  return target
}
