import 'pinia-react'

declare module 'pinia-react' {
  export interface PiniaCustomProperties {
    save: () => void
    clearPersistence: () => void
    readonly $isPersisted: boolean
  }
}
