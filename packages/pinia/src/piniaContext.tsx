'use client'

import { createContext, type ReactNode, useContext, useState } from 'react'
import { createPiniaInstance } from './createPinia'
import { setActivePinia } from './rootStore'
import type { Pinia, PiniaInitialStores, PiniaPlugin } from './types'

const PiniaContext = createContext<Pinia | undefined>(undefined)

export interface PiniaProviderProps {
  initialStores?: PiniaInitialStores
  /** Registered once, before any store is created. Changes after mounting are ignored. */
  plugins?: readonly PiniaPlugin[]
  children: ReactNode
}

export function PiniaProvider({ initialStores, plugins, children }: PiniaProviderProps) {
  const [pinia] = useState(() => {
    const instance = createPiniaInstance()
    instance._initialStores = { ...initialStores }
    plugins?.forEach((plugin) => instance.use(plugin))
    return instance
  })
  if (typeof window !== 'undefined') setActivePinia(pinia)
  return <PiniaContext.Provider value={pinia}>{children}</PiniaContext.Provider>
}

export function usePiniaContext() {
  return useContext(PiniaContext)
}
