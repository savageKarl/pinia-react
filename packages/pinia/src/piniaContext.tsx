'use client'

import { createContext, type ReactNode, useContext, useState } from 'react'
import { createPiniaInstance } from './createPinia'
import { assertActive } from './lifecycle'
import { assertStateValue } from './mutationProxy'
import { setActivePinia } from './rootStore'
import type { Pinia, PiniaInitialStores, PiniaPlugin } from './types'

const PiniaContext = createContext<Pinia | undefined>(undefined)

export interface PiniaProviderProps {
  children: ReactNode
  pinia?: Pinia
  initialStores?: PiniaInitialStores
  /** Registered once, before any store is created. Changes after mounting are ignored. */
  plugins?: readonly PiniaPlugin[]
}

export function PiniaProvider({ pinia: supplied, initialStores, plugins, children }: PiniaProviderProps) {
  if (supplied !== undefined && (initialStores !== undefined || plugins !== undefined)) {
    throw new Error('[pinia-react] A supplied Pinia cannot be combined with initialStores or plugins.')
  }
  const [pinia] = useState(() => {
    if (supplied !== undefined) {
      assertActive(supplied)
      return supplied
    }
    assertStateValue(initialStores)
    const instance = createPiniaInstance()
    Object.assign(instance._initialStores, initialStores)
    plugins?.forEach((plugin) => instance.use(plugin))
    return instance
  })
  assertActive(pinia)
  if (typeof window !== 'undefined') setActivePinia(pinia)
  return <PiniaContext.Provider value={pinia}>{children}</PiniaContext.Provider>
}

export function usePiniaContext() {
  return useContext(PiniaContext)
}
