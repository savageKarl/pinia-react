type ObjectState = Record<string, unknown>
const forbidden = new Set(['__proto__', 'constructor', 'prototype'])

function isPlainObject(value: unknown): value is ObjectState {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertObject(value: unknown): asserts value is ObjectState {
  if (!isPlainObject(value)) throw new TypeError('Persisted state must be a plain object')
}

/** Detach mutable JSON trees and reject unsafe keys, including keys inside arrays. */
function clone(value: unknown, ancestors = new Set<object>()): unknown {
  if (!isPlainObject(value) && !Array.isArray(value)) return value
  if (ancestors.has(value)) throw new TypeError('Circular state cannot be persisted')
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => clone(item, ancestors))
    const result: ObjectState = {}
    for (const key of Object.keys(value)) {
      if (forbidden.has(key)) throw new TypeError('Unsafe persisted state key')
      result[key] = clone(value[key], ancestors)
    }
    return result
  } finally {
    ancestors.delete(value)
  }
}

function parsePath(path: string): string[] {
  const parts = path.split('.')
  if (parts.some((part) => !part || forbidden.has(part))) throw new TypeError('Unsafe or empty persistence path')
  return parts
}

function readPath(state: ObjectState, parts: string[]): { value: unknown } | undefined {
  let current: unknown = state
  for (const part of parts) {
    if (!isPlainObject(current) || !Object.hasOwn(current, part)) return
    current = current[part]
  }
  return { value: current }
}

function putPath(state: ObjectState, parts: string[], value: unknown) {
  let current = state
  for (const part of parts.slice(0, -1)) {
    if (!isPlainObject(current[part])) current[part] = {}
    current = current[part] as ObjectState
  }
  current[parts[parts.length - 1]] = clone(value)
}

export function filterState(state: unknown, pick?: readonly string[], omit?: readonly string[]): ObjectState {
  assertObject(state)
  const picks = pick?.map(parsePath)
  const omits = omit?.map(parsePath)
  const snapshot = clone(state) as ObjectState
  const result: ObjectState = picks ? {} : snapshot
  for (const path of picks ?? []) {
    const entry = readPath(snapshot, path)
    if (entry) putPath(result, path, entry.value)
  }
  for (const path of omits ?? []) {
    const parent = readPath(result, path.slice(0, -1))?.value
    if (isPlainObject(parent)) delete parent[path[path.length - 1]]
  }
  return result
}

/** Full state merge, deliberately separate from core $patch's shallow semantics. */
export function mergeState(current: unknown, saved: unknown): ObjectState {
  assertObject(current)
  assertObject(saved)
  const result = clone(current) as ObjectState
  const source = clone(saved) as ObjectState
  function merge(target: ObjectState, next: ObjectState) {
    for (const key of Object.keys(next)) {
      const previous = target[key]
      const value = next[key]
      if (isPlainObject(previous) && isPlainObject(value)) merge(previous, value)
      else target[key] = value
    }
  }
  merge(result, source)
  return result
}
