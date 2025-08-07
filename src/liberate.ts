import { StoreGeneric, StateTree, LiberatePlugin } from './types'

interface Liberate {
  _store: Map<string, StoreGeneric>
  _state: Map<string, StateTree>
  _plugins: Set<LiberatePlugin>
  use(plugin: LiberatePlugin): this
}

export let liberate: Liberate

export function createLiberate(): Liberate {
  return {
    _store: new Map<string, StoreGeneric>(),
    _state: new Map<string, StateTree>(),
    _plugins: new Set<LiberatePlugin>(),
    use(p) {
      this._plugins.add(p)
      return this
    }
  }
}

export function setActiveLiberate(_liberate: Liberate) {
  liberate = _liberate
}

setActiveLiberate(createLiberate())
