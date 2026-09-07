import type { StateTree } from 'pinia-react'

export interface DevtoolsOptions {
  enabled: true
  name?: string
  trace?: boolean
}

export interface DevtoolsPluginOptions {
  name?: string
}

declare module 'pinia-react' {
  interface DefineStoreOptionsBase<S extends StateTree, Store> {
    devtools?: DevtoolsOptions
  }
}
