'use client'

import { createContext, type ReactNode, useContext, useState } from 'react'
import { createPiniaInstance } from './createPinia'
import { setActivePinia } from './rootStore'
import type { Pinia, PiniaInitialStores } from './types'

const PiniaContext = createContext<Pinia | undefined>(undefined)

export interface PiniaProviderProps {
  initialStores?: PiniaInitialStores
  children: ReactNode
}

export function PiniaProvider({ initialStores, children }: PiniaProviderProps) {
  const [pinia] = useState(() => {
    const instance = createPiniaInstance()
    instance._initialStores = { ...initialStores }
    return instance
  })
  if (typeof window !== 'undefined') setActivePinia(pinia)
  return <PiniaContext.Provider value={pinia}>{children}</PiniaContext.Provider>
}

export function usePiniaContext() {
  return useContext(PiniaContext)
}
