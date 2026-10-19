import { assertActive } from './lifecycle'
import type { Pinia } from './types'

export let activePinia: Pinia | undefined

export function setActivePinia(pinia: Pinia) {
  assertActive(pinia)
  activePinia = pinia
}

export function clearActivePinia(pinia: Pinia): void {
  if (activePinia === pinia) activePinia = undefined
}

export function getActivePinia(): Pinia {
  if (!activePinia) {
    throw new Error(
      '[pinia-react] getActivePinia was called with no active Pinia. Did you forget to install pinia?\n' +
        'const pinia = createPinia() or createPinia() first.\n'
    )
  }
  assertActive(activePinia)
  return activePinia
}
