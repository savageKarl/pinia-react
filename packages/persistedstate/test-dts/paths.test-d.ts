import type { StatePath } from '../src'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
function exact<T extends true>(_proof: T) {}

type Suggested = StatePath<{
  count: number
  profile?: { name: string } | null
  selected: { first: string } | { second: number } | null
  items: readonly { name: string }[]
  date: Date
  pattern: RegExp
  map: Map<string, number>
  set: Set<string>
  promise: Promise<string>
  callback: () => void
  'literal.dot': string
  '': string
  __proto__: { unsafe: string }
  constructor: string
  prototype: string
}>
exact<
  Equal<
    Suggested,
    | 'count'
    | 'profile'
    | 'profile.name'
    | 'selected'
    | 'selected.first'
    | 'selected.second'
    | 'items'
    | 'date'
    | 'pattern'
    | 'map'
    | 'set'
    | 'promise'
    | 'callback'
  >
>(true)
exact<Equal<StatePath<any>, never>>(true)
exact<Equal<StatePath<unknown>, never>>(true)

interface Node {
  label: string
  next?: Node
}
type Recursive = StatePath<{ node: Node }>
exact<Equal<Extract<Recursive, 'node.next.next.next.next.label'>, 'node.next.next.next.next.label'>>(true)
exact<Equal<Extract<Recursive, 'node.next.next.next.next.next.label'>, never>>(true)
