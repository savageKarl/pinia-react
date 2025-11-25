import { activePinia, setActivePinia } from './rootStore'
import type { Pinia, StateTree, StoreGeneric } from './types'

export function createPinia(): Pinia {
  if (process.env.NODE_ENV !== 'production' && activePinia) {
    console.warn(
      '[pinia-react] createPinia() was called while a Pinia instance is already active.' +
        ' This may lead to unexpected behavior, such as plugins not being applied correctly.' +
        ' In client-side applications, you should usually only call createPinia() once.' +
        ' In SSR, this might be intentional for request isolation.'
    )
  }

  const state: Record<string, StateTree> = {}
  const _p: Pinia['_p'] = []
  const _s = new Map<string, StoreGeneric>()

  const pinia: Pinia = {
    use(plugin) {
      _p.push(plugin)
      return this
    },
    _p,
    _s,
    state
  }

  setActivePinia(pinia)

  return pinia
}
