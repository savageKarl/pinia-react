import {
  expectType,
  createPinia,
  StoreGeneric,
  Pinia,
  StateTree,
  DefineStoreOptionsInPlugin,
} from '.'

const pinia = createPinia()

pinia.use(({ store, options, pinia }) => {
  expectType<StoreGeneric>(store)
  expectType<Pinia>(pinia)
  expectType<
    DefineStoreOptionsInPlugin<
      string,
      StateTree,
      Record<string, any>,
      Record<string, any>
    >
  >(options)
})
