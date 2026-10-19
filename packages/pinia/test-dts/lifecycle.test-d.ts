import { createPinia, defineStore, disposePinia, expectType, type PiniaPluginContext } from '.'

const pinia = createPinia()
expectType<void>(disposePinia(pinia))
const cleanup = () => {}
pinia.use(({ onDispose }) => {
  if (!onDispose) return
  const cancel = onDispose(cleanup)
  expectType<() => void>(cancel)
  expectType<void>(cancel())
  // @ts-expect-error A cleanup callback is required.
  onDispose()
  // @ts-expect-error Cleanup must be callable.
  onDispose(1)
})
// @ts-expect-error An explicit instance is required.
disposePinia()
// @ts-expect-error There are no lifecycle options.
disposePinia(pinia, { reusable: true })
const store = defineStore('lifetime', { state: () => ({ count: 0 }) }).getStore(pinia)
// @ts-expect-error Dynamic Store disposal is not public.
store.$dispose()
declare const context: PiniaPluginContext
const { onDispose: _onDispose, ...oldContext } = context
const legacyHost: PiniaPluginContext = oldContext
void legacyHost
