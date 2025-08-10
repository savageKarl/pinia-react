import type { PiniaPlugin, StateTree, StoreGeneric } from './types'

interface Pinia {
  _store: Map<string, StoreGeneric>
  _state: Map<string, StateTree>
  _plugins: Set<PiniaPlugin>
  use(plugin: PiniaPlugin): this
}

export let pinia: Pinia

export function createPinia(): Pinia {
  return {
    _store: new Map<string, StoreGeneric>(),
    _state: new Map<string, StateTree>(),
    _plugins: new Set<PiniaPlugin>(),
    use(p) {
      this._plugins.add(p)
      return this
    }
  }
}

export function setActivePinia(_pinia: Pinia) {
  pinia = _pinia
}

setActivePinia(createPinia())
