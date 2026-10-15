import { type PiniaInitialStores, PiniaProvider, type PiniaProviderProps } from 'pinia-react/next'
import { defineStore, expectType, type MutationEvent, type MutationMeta, type TypeEqual } from '.'

const { useAccountStore, getAccountStore } = defineStore('account', {
  state: () => ({ count: 0, user: { name: 'Ada', level: 1 } }),
  actions: {
    increment() {
      this.$patch({ count: this.count + 1 })
      return this.count
    },
    async load(name: string) {
      await Promise.resolve()
      this.user.name = name
      return this.user
    },
    patch() {
      this.$patch((draft) => {
        draft.count++
      })
    }
  }
})
const store = getAccountStore()
store.$patch({ count: 2 })
store.$patch({ user: { name: 'Lin', level: 2 } })
// @ts-expect-error invalid field
store.$patch({ missing: true })
// @ts-expect-error invalid type
store.$patch({ count: '2' })
// @ts-expect-error object patches replace nested objects rather than deep merging
store.$patch({ user: { name: 'Lin' } })
store.$subscribe((state, previous, event) => {
  expectType<number>(state.count)
  expectType<number>(previous.count)
  expectType<MutationEvent<typeof state> | undefined>(event)
  expectType<string | undefined>(event?.meta.actionId)
  expectType<string | undefined>(event?.meta.parentActionId)
})
store.$subscribe((state, previous) => expectType<number>(state.count + previous.count))
const meta: MutationMeta = { type: 'action', actionId: 'opaque', parentActionId: 'parent' }
expectType<string | undefined>(meta.actionId)
expectType<number>(store.increment())
expectType<Promise<{ name: string; level: number }>>(store.load('Ada'))
expectType<TypeEqual<ReturnType<typeof useAccountStore>, ReturnType<typeof getAccountStore>>>(true)
const initialStores: PiniaInitialStores = { account: { count: 3, user: { name: 'Ada', level: 1 } } }
const props: PiniaProviderProps = { initialStores, children: null }
expectType<React.ReactNode>(PiniaProvider(props))
// @ts-expect-error children is required
const missingChildren: PiniaProviderProps = { initialStores }
void missingChildren
