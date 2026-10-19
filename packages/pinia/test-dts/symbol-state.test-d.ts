import type { Patch } from 'immer'
import {
  createPinia,
  defineStore,
  expectType,
  type MutationEvent,
  type StatePath,
  type StateTree,
  type TypeEqual
} from '.'

const marker = Symbol('unsupported')
expectType<TypeEqual<StateTree, Record<string, any>>>(true)
expectType<TypeEqual<StatePath, string[]>>(true)
expectType<TypeEqual<MutationEvent['patches'], Patch[]>>(true)
const path: StatePath = ['nested', 'count']
const legacyPath: string[] = path
expectType<StatePath>(legacyPath)
// @ts-expect-error business state paths do not contain symbols
const invalidPath: StatePath = [marker]
void invalidPath
// @ts-expect-error the public event does not claim to emit symbol patches
const invalidPatch: MutationEvent['patches'][number] = { op: 'replace', path: [marker], value: 1 }
void invalidPatch

const { getStore } = defineStore('legacy-patches', { state: () => ({ count: 0, $pinia: 'business' }) })
const store = getStore()
expectType<string>(store.$pinia)
store.$subscribe((_state, _previous, event) => {
  if (event) {
    const patches: Patch[] = event.patches
    expectType<Patch[]>(patches)
  }
})
createPinia().onMutation((event) => {
  const patches: Patch[] = event.patches
  expectType<Patch[]>(patches)
})
function readGenericEvent(event: MutationEvent) {
  const patches: Patch[] = event.patches
  expectType<Patch[]>(patches)
}
void readGenericEvent
