import { filterState, mergeState } from '../src/utils'

const defaults = { profile: { name: 'Ada', theme: 'light', secret: 'token' }, items: [1, 2], count: 1 }

it('picks nested paths, ignores missing paths, then omits, without mutating inputs', () => {
  const before = structuredClone(defaults)
  expect(filterState(defaults, ['profile', 'missing.path', 'count'], ['profile.secret'])).toEqual({
    profile: { name: 'Ada', theme: 'light' },
    count: 1
  })
  expect(defaults).toEqual(before)
  expect(filterState(defaults, ['profile.name'], [])).toEqual({ profile: { name: 'Ada' } })
  expect(filterState(defaults, ['missing.path'])).toEqual({})
})

it('distinguishes no pick, empty pick, and empty omit; snapshots are detached', () => {
  expect(filterState(defaults, [])).toEqual({})
  const result = filterState(defaults, undefined, [])
  expect(result).toEqual(defaults)
  expect(result.profile).not.toBe(defaults.profile)
  expect(result.items).not.toBe(defaults.items)
  expect(filterState(defaults, ['profile.name', 'profile'], ['profile.theme'])).toEqual({
    profile: { name: 'Ada', secret: 'token' }
  })
})

it('treats arrays as whole fields, not projections', () => {
  expect(filterState(defaults, ['items'])).toEqual({ items: [1, 2] })
  expect(filterState(defaults, ['items.0'])).toEqual({})
  expect(filterState(defaults, undefined, ['items.0'])).toEqual(defaults)
})

it('recursively merges objects, replaces arrays, preserves absent fields, and allows null', () => {
  const payload = { profile: { theme: 'dark' }, items: [3], count: null }
  const before = structuredClone(payload)
  const result = mergeState(defaults, payload)
  expect(result).toEqual({ profile: { name: 'Ada', theme: 'dark', secret: 'token' }, items: [3], count: null })
  expect(payload).toEqual(before)
  expect(defaults.items).toEqual([1, 2])
  expect(result.profile).not.toBe(defaults.profile)
  expect(result.profile).not.toBe(payload.profile)
  expect(result.items).not.toBe(payload.items)
  expect(mergeState({ field: null }, { field: { next: true } })).toEqual({ field: { next: true } })
})

it.each([null, [], 'text', 1, true, undefined, new Date(), new Map(), Promise.resolve({})])(
  'rejects invalid top-level payload %j',
  (payload) => {
    expect(() => filterState(payload)).toThrow()
    expect(() => mergeState(defaults, payload)).toThrow()
  }
)

it.each(['__proto__.polluted', 'profile.constructor.polluted', 'profile.prototype.polluted', 'profile..name', ''])(
  'rejects dangerous or malformed paths %s',
  (path) => {
    expect(() => filterState(defaults, [path])).toThrow()
    expect(() => filterState(defaults, undefined, [path])).toThrow()
    expect(Object.prototype).not.toHaveProperty('polluted')
  }
)

it.each(['__proto__', 'constructor', 'prototype'])('rejects dangerous keys at any object/array depth: %s', (key) => {
  const payload = JSON.parse(`{"items":[{"${key}":{"polluted":true}}]}`)
  expect(() => filterState(payload)).toThrow()
  expect(() => mergeState(defaults, payload)).toThrow()
  expect(Object.prototype).not.toHaveProperty('polluted')
  expect(defaults).not.toHaveProperty('polluted')
})

it('does not read inherited paths and rejects cycles instead of overflowing', () => {
  expect(filterState({}, ['toString'])).toEqual({})
  const cycle: Record<string, unknown> = {}
  cycle.self = cycle
  expect(() => filterState(cycle)).toThrow()
})
