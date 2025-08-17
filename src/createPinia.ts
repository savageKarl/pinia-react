import { effectScope, markRaw, type Ref, ref } from '@maoism/runtime-core'
import { type Pinia, setActivePinia } from './rootStore'
import type { StateTree, StoreGeneric } from './types'

/**
 * Creates a Pinia instance to be used by the application
 */
export function createPinia(): Pinia {
  const scope = effectScope(true)

  const state = scope.run<Ref<Record<string, StateTree>>>(() => ref<Record<string, StateTree>>({}))!

  const _p: Pinia['_p'] = []

  const pinia: Pinia = markRaw({
    use(plugin) {
      _p.push(plugin)
      return this
    },
    _p,
    _e: scope,
    _s: new Map<string, StoreGeneric>(),
    state
  })

  setActivePinia(pinia)

  return pinia
}
