import { setActivePinia } from './rootStore'
import type { Pinia, StateTree, StoreGeneric } from './types'

export function createPinia(): Pinia {
  const state: Record<string, StateTree> = {}
  const _p: Pinia['_p'] = []
  const _s = new Map<string, StoreGeneric>()
  const _scopes = new Map()

  const pinia: Pinia = {
    use(plugin) {
      _p.push(plugin)
      return this
    },
    _p,
    _s,
    _scopes,
    state
  }

  setActivePinia(pinia)

  return pinia
}
