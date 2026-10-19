import {
  createPinia,
  defineStore,
  expectType,
  type PiniaPluginContext,
  type PiniaProviderProps,
  type TypeEqual
} from '.'

const pinia = createPinia()
const state = defineStore('business-state', {
  state: () => ({ $pinia: 'business' }),
  getters: {
    label(): string {
      return this.$pinia
    }
  },
  actions: {
    rename() {
      this.$pinia = 'renamed'
    }
  }
}).getStore(pinia)
expectType<TypeEqual<typeof state.$pinia, string>>(true)
expectType<string>(state.label)
const getter = defineStore('business-getter', {
  state: () => ({ count: 0 }),
  getters: { $pinia: (state) => state.count }
}).getStore(pinia)
expectType<TypeEqual<typeof getter.$pinia, number>>(true)
const action = defineStore('business-action', {
  state: () => ({}),
  actions: {
    $pinia() {
      return 'action'
    }
  }
}).getStore(pinia)
expectType<string>(action.$pinia())

declare const context: PiniaPluginContext
const { onDispose: _onDispose, ...legacy } = context
const oldHost: PiniaPluginContext = legacy
expectType<(() => void) | undefined>(oldHost.onDispose?.(() => {}))

interface CustomProps extends PiniaProviderProps {
  label?: string
}
const extendedProps: CustomProps = { children: null, label: 'legacy' }
expectType<import('./index').PiniaProviderProps>(extendedProps)

declare module '../src' {
  export interface PiniaCustomProperties<Id extends string = string> {
    $pinia: Id extends 'business-plugin-typed' ? string : unknown
  }
}
pinia.use(() => ({ $pinia: 'plugin metadata' }))
const plugin = defineStore('business-plugin-typed', { state: () => ({}) }).getStore(pinia)
expectType<TypeEqual<typeof plugin.$pinia, string>>(true)
