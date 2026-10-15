import { defineStore, type MutationEvent, type PiniaPlugin } from 'pinia-react'
import { type DevtoolsOptions, expectType } from '.'

const options: DevtoolsOptions = { enabled: true, name: 'App', trace: true }
expectType<true>(options.enabled)

defineStore('app', {
  state: () => ({ count: 0 }),
  devtools: {
    enabled: true,
    name: 'App Store',
    trace: true
  }
})

defineStore('invalid', {
  state: () => ({ count: 0 }),
  devtools: {
    // @ts-expect-error devtools is opt-in only
    enabled: false
  }
})

const observeAction: PiniaPlugin = ({ pinia, store }) => {
  pinia.onMutation((event: MutationEvent) => {
    expectType<string | undefined>(event.meta.actionId)
    expectType<string | undefined>(event.meta.parentActionId)
    expectType<string | undefined>(event.meta.origin)
  })
  store.$subscribe((_state, _previous, event) => {
    expectType<MutationEvent | undefined>(event)
  })
}
void observeAction
