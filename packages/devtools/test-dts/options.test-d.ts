import { defineStore } from 'pinia-react'
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
