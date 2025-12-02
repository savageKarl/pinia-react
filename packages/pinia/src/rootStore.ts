import type { Pinia } from './types'

export let activePinia: Pinia | undefined

export function setActivePinia(pinia: Pinia) {
  activePinia = pinia
}

export function getActivePinia(): Pinia {
  if (!activePinia) {
    throw new Error(
      '[pinia-react] getActivePinia was called with no active Pinia. Did you forget to install pinia?\n' +
        'const pinia = createPinia() or createPinia() first.\n'
    )
  }
  return activePinia
}
