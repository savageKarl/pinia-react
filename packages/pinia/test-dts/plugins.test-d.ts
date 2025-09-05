import {
  createPinia,
  type DefineStoreOptionsInPlugin,
  expectType,
  type Pinia,
  type StateTree,
  type StoreGeneric
} from '.'

const pinia = createPinia()

pinia.use(({ store, options, pinia }) => {
  expectType<StoreGeneric>(store)
  expectType<Pinia>(pinia)
  expectType<DefineStoreOptionsInPlugin<string, StateTree, Record<string, any>, Record<string, any>>>(options)
})
