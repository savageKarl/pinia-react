// packages/pinia/src/createPinia.ts
import { setActivePinia } from './rootStore'
import type { Pinia, StateTree, StoreGeneric } from './types'

export function createPinia(): Pinia {
  const state: Record<string, StateTree> = {}

  const _p: Pinia['_p'] = []

  const pinia: Pinia = {
    use(plugin) {
      _p.push(plugin)
      return this
    },
    _p,
    _s: new Map<string, StoreGeneric>(),
    state
  }

  setActivePinia(pinia)

  return pinia
}
