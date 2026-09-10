import { setActivePinia } from './rootStore'
import type { MutationListener, Pinia, StateTree, StoreGeneric } from './types'

export function createPinia(): Pinia {
  const state: Record<string, StateTree> = {}
  const _p: Pinia['_p'] = []
  const _s = new Map<string, StoreGeneric>()
  const _scopes = new Map()
  const _m = new Set<MutationListener>()

  const pinia: Pinia = {
    use(plugin) {
      if (_s.size > 0) {
        console.warn(
          '[pinia-react] A plugin was registered after stores were created. ' +
            'The new plugin will not be applied to the stores that already exist.'
        )
      }
      _p.push(plugin)
      return this
    },
    onMutation(listener) {
      _m.add(listener)
      return () => _m.delete(listener)
    },
    _p,
    _s,
    _scopes,
    _m,
    state
  }

  setActivePinia(pinia)

  return pinia
}
