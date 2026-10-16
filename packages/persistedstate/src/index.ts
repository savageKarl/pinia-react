import { createPersistedState } from './persistedstate'
export { createPersistedState }
export type {
  HydrateOptions,
  Persist,
  PersistenceContext,
  PersistenceOptions,
  PluginOptions,
  Serializer,
  StatePath,
  StorageLike
} from './types'
export default createPersistedState()
