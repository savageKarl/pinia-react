import { assertActive, ownSubscription } from './lifecycle'
import { setActivePinia } from './rootStore'
import type { MutationListener, Pinia, StateTree, StoreGeneric } from './types'

export function createPinia(): Pinia {
  const pinia = createPiniaInstance()
  setActivePinia(pinia)
  return pinia
}

/** Internal factory: rendering a Provider on the server must not change activePinia. */
export function createPiniaInstance(): Pinia {
  const state: Record<string, StateTree> = {}
  const _p: Pinia['_p'] = []
  const _s = new Map<string, StoreGeneric>()
  const _scopes = new Map()
  const _m = new Set<MutationListener>()

  const pinia: Pinia = {
    use(plugin) {
      assertActive(pinia)
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
      assertActive(pinia)
      const subscription: MutationListener = (event) => listener(event)
      _m.add(subscription)
      return ownSubscription(pinia, () => {
        _m.delete(subscription)
      })
    },
    _p,
    _s,
    _scopes,
    _m,
    _initialStores: {},
    state
  }

  return pinia
}
