import { isDraft } from 'immer'
import { createPinia, defineStore, type MutationEvent } from '../src'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('Action commit contracts', () => {
  beforeEach(() => createPinia())

  it('does not emit mutations for read-only actions or unchanged array operations', () => {
    const listener = vi.fn()
    createPinia().onMutation(listener)
    const { getStore } = defineStore('no-op', {
      state: () => ({ count: 1, items: [1, 2], empty: [] as number[] }),
      actions: {
        inspect() {
          this.count = 1
          this.items.sort()
          expect(this.empty.pop()).toBeUndefined()
          return this.items.map((item) => item + this.count)
        }
      }
    })
    expect(getStore().inspect()).toEqual([2, 3])
    expect(listener).not.toHaveBeenCalled()
  })

  it('commits each real write immediately and keeps nested actions and patches', () => {
    const pinia = createPinia()
    const events: MutationEvent[] = []
    pinia.onMutation((event) => events.push(event))
    const { getStore } = defineStore('nested', {
      state: () => ({ a: 0, b: 0, c: 0 }),
      actions: {
        inner() {
          this.b++
        },
        outer() {
          this.a++
          this.inner()
          this.$patch((draft) => {
            draft.c = this.a + this.b
          })
          this.a++
          this.a = this.a
        }
      }
    })
    const store = getStore()
    store.outer()
    expect(store.$state).toEqual({ a: 2, b: 1, c: 2 })
    expect(events.map((event) => event.meta.type)).toEqual(['action', 'action', 'patch', 'action'])
    const outerId = events[0].meta.actionId
    expect(outerId).toEqual(expect.any(String))
    expect(events[1].meta).toMatchObject({ action: 'inner', parentActionId: outerId })
    expect(events[1].meta.actionId).not.toBe(outerId)
    expect(events[2].meta).toMatchObject({ action: 'outer', actionId: outerId })
    expect(events[3].meta.actionId).toBe(outerId)
    expect(events.map((event) => event.state.a)).toEqual([1, 1, 1, 2])
    expect(pinia.state.nested).toEqual(store.$state)
  })

  it('reads the latest state through references captured before await in concurrent actions', async () => {
    const first = deferred()
    const second = deferred()
    const events: MutationEvent[] = []
    createPinia().onMutation((event) => events.push(event))
    const { getStore } = defineStore('concurrent', {
      state: () => ({ count: 0, user: { name: 'before' }, items: [0] }),
      actions: {
        async update(gate: Promise<void>, name: string) {
          const user = this.user
          const items = this.items
          this.count++
          await gate
          this.count++
          user.name = name
          items.push(this.count)
          return { count: this.count, name: user.name }
        }
      }
    })
    const store = getStore()
    const a = store.update(first.promise, 'first')
    const b = store.update(second.promise, 'second')
    expect(store.count).toBe(2)
    second.resolve()
    await expect(b).resolves.toEqual({ count: 3, name: 'second' })
    first.resolve()
    await expect(a).resolves.toEqual({ count: 4, name: 'first' })
    expect(store.items).toEqual([0, 3, 4])
    expect(new Set(events.map((event) => event.meta.actionId)).size).toBe(2)
    expect(events.every((event) => event.meta.actionId)).toBe(true)
  })

  it('preserves committed writes when synchronous and asynchronous actions fail', async () => {
    const { getStore } = defineStore('errors', {
      state: () => ({ count: 0 }),
      actions: {
        fail() {
          this.count++
          throw new Error('sync')
        },
        async reject() {
          this.count++
          await Promise.resolve()
          this.count++
          throw new Error('async')
        }
      }
    })
    const store = getStore()
    expect(() => store.fail()).toThrow('sync')
    expect(store.count).toBe(1)
    await expect(store.reject()).rejects.toThrow('async')
    expect(store.count).toBe(3)
  })

  it('supports shallow object patches, with action metadata and a single commit', () => {
    const events: MutationEvent[] = []
    createPinia().onMutation((event) => events.push(event))
    const { getStore } = defineStore('object-patch', {
      state: () => ({ count: 0, user: { name: 'before' } }),
      actions: {
        update() {
          this.$patch({ count: 2, user: { name: 'after' } })
        }
      }
    })
    const store = getStore()
    store.update()
    expect(store.$state).toEqual({ count: 2, user: { name: 'after' } })
    expect(events).toHaveLength(1)
    expect(events[0].meta).toMatchObject({ type: 'patch', action: 'update', actionId: expect.any(String) })
    store.$patch({ count: 2 })
    expect(events).toHaveLength(1)
  })

  it.each(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'] as const)(
    'batches array %s into one commit and returns normal values',
    (method) => {
      const events: MutationEvent[] = []
      createPinia().onMutation((event) => events.push(event))
      const { getStore } = defineStore('arrays', {
        state: () => ({ items: [3, 1, 2] }),
        actions: {
          update() {
            switch (method) {
              case 'push':
                return this.items.push(4, 5)
              case 'pop':
                return this.items.pop()
              case 'shift':
                return this.items.shift()
              case 'unshift':
                return this.items.unshift(4, 5)
              case 'splice':
                return this.items.splice(0, 2, 7)
              case 'sort':
                return this.items.sort()
              case 'reverse':
                return this.items.reverse()
              case 'fill':
                return this.items.fill(7)
              case 'copyWithin':
                return this.items.copyWithin(0, 1)
            }
          }
        }
      })
      const store = getStore()
      const expected = [3, 1, 2]
      let expectedReturn: unknown
      switch (method) {
        case 'push':
          expectedReturn = expected.push(4, 5)
          break
        case 'pop':
          expectedReturn = expected.pop()
          break
        case 'shift':
          expectedReturn = expected.shift()
          break
        case 'unshift':
          expectedReturn = expected.unshift(4, 5)
          break
        case 'splice':
          expectedReturn = expected.splice(0, 2, 7)
          break
        case 'sort':
          expectedReturn = expected.sort()
          break
        case 'reverse':
          expectedReturn = expected.reverse()
          break
        case 'fill':
          expectedReturn = expected.fill(7)
          break
        case 'copyWithin':
          expectedReturn = expected.copyWithin(0, 1)
          break
      }
      const result = store.update()
      expect(store.items).toEqual(expected)
      expect(result).toEqual(expectedReturn)
      expect(isDraft(result)).toBe(false)
      expect(events).toHaveLength(1)
    }
  )

  it('supports reflection, array reads, dotted keys, deletion and draft-free object returns', async () => {
    const { getStore } = defineStore('reflection', {
      state: () => ({ 'a.b': { x: 1, optional: 2 as number | undefined }, items: [{ n: 1 }, { n: 2 }], empty: {} }),
      actions: {
        async update() {
          const nested = this['a.b']
          expect(isDraft(nested)).toBe(false)
          expect(Object.keys(nested)).toEqual(['x', 'optional'])
          expect('x' in nested).toBe(true)
          expect(Object.keys(this.empty)).toEqual([])
          expect([...this.items].map((item) => item.n)).toEqual([1, 2])
          expect(this.items.map((item) => item.n)).toEqual([1, 2])
          await Promise.resolve()
          nested.x++
          delete nested.optional
          this.items[0].n = 3
          const removed = this.items.splice(0, 1)
          return { nested, removed }
        }
      }
    })
    const store = getStore()
    const result = await store.update()
    expect(result.nested).toEqual({ x: 2 })
    expect(result.removed).toEqual([{ n: 3 }])
    expect(isDraft(result.nested)).toBe(false)
    expect(isDraft(result.removed[0])).toBe(false)
    expect(store.items).toEqual([{ n: 2 }])
  })

  it('does not store live mutation proxies when assigning or inserting state references', () => {
    const { getStore } = defineStore('references', {
      state: () => ({ user: { name: 'first' }, other: { name: 'other' }, items: [] as { user: { name: string } }[] }),
      actions: {
        copy() {
          this.other = this.user
          this.items.push({ user: this.user })
        },
        update() {
          this.user.name = 'next'
        }
      }
    })
    const store = getStore()
    store.copy()
    store.update()
    expect(store.other.name).toBe('first')
    expect(store.items[0].user.name).toBe('first')
    expect(JSON.parse(JSON.stringify(store.$state))).toEqual({
      user: { name: 'next' },
      other: { name: 'first' },
      items: [{ user: { name: 'first' } }]
    })
  })

  it('never passes drafts to an object array sort comparator', () => {
    let compared: { n: number } | undefined
    const { getStore } = defineStore('sort-objects', {
      state: () => ({ items: [{ n: 2 }, { n: 1 }] }),
      actions: {
        sort() {
          this.items.sort((a, b) => {
            expect(isDraft(a)).toBe(false)
            expect(isDraft(b)).toBe(false)
            compared = a
            return a.n - b.n
          })
        }
      }
    })
    getStore().sort()
    expect(compared?.n).toBe(1)
    expect(getStore().items).toEqual([{ n: 1 }, { n: 2 }])
  })

  it('resolves captured action references assigned in a function patch before committing', () => {
    const events: MutationEvent[] = []
    createPinia().onMutation((event) => events.push(event))
    const { getStore } = defineStore('patch-references', {
      state: () => ({ user: { name: 'first' }, other: { name: 'other' }, items: [] as { name: string }[] }),
      actions: {
        copy() {
          const user = this.user
          this.$patch((draft) => {
            draft.other = user
            draft.items.push(user)
          })
        },
        update() {
          this.user.name = 'next'
        }
      }
    })
    const store = getStore()
    store.copy()
    store.update()
    expect(store.other.name).toBe('first')
    expect(store.items).toEqual([{ name: 'first' }])
    expect(events[0].state).toEqual({ user: { name: 'first' }, other: { name: 'first' }, items: [{ name: 'first' }] })
    expect(events[0].patches.filter((patch) => patch.op !== 'remove').map((patch) => patch.value)).toEqual([
      { name: 'first' },
      { name: 'first' }
    ])
  })

  it('retains the parent context for nested actions and patches after await', async () => {
    const events: MutationEvent[] = []
    createPinia().onMutation((event) => events.push(event))
    const { getStore } = defineStore('async-parent', {
      state: () => ({ count: 0 }),
      actions: {
        inner() {
          this.count++
        },
        async outer() {
          this.count++
          await Promise.resolve()
          this.inner()
          this.$reset()
        }
      }
    })
    await getStore().outer()
    expect(events[1].meta.parentActionId).toBe(events[0].meta.actionId)
    expect(events[2].meta).toMatchObject({ type: 'reset', actionId: events[0].meta.actionId })
  })
})
