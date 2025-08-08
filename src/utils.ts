import react from 'react'
import { isRef, isReactive, ReactiveEffect } from '@vue/runtime-core'
import { isObject, isArray, isUndefined } from 'savage-types'
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
      // @ts-ignore
      yValue.forEach((_, k2) => (x[k][k2] = yValue[k2]))
    } else {
      x[k] = copyDeep(y[k] as object) as T[Extract<keyof T, string>]
    }
  }
}

export function noop() {
  return {}
}

export function isPlainObject<S extends StateTree>(value: S | unknown): value is S
export function isPlainObject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  o: any
): o is StateTree {
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
      // eslint-disable-next-line no-prototype-builtins
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

export function useRender() {
  const [, setState] = react.useState({})
  const render = react.useCallback(() => setState({}), [])

  return render
}

type Func = () => void

export function setActiveEffect() {
  const fn = () => {}

  const effect = new ReactiveEffect(fn);

  effect.run() // 这一步是手动触发收集.,不过,在 react 里面,要再好好考虑,因为可能会导致渲染多次.后面仔细考虑
  // 使用 useSyncExternalStore
  // 现在作用收集变得简单了, 直接 new ReactiveEffect(fn),fn 就是数量变化会执行的辅作用函数 ,正常


  // const render = useRender()

  // 这里收集作用的核心地方，要重写
  // let effect = effectMap.get(render)
  // if (!effect) {
  //   effect = new ReactiveEffect(noop, noop, () => {
  //     render()
  //     if (effect?.dirty) effect.run()
  //   })
  //   effect.run()
  //   effectMap.set(render, effect)
  // }

  // activeEffect.value = effect
}
