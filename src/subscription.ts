import type { Fun, StateTree } from './types'
import { noop } from './utils'

const subscriptions: Set<Fun> = new Set()

export function addSubscriptions<T extends Fun>(
  callback: T,
  onCleanup: () => void = noop
) {
  subscriptions.add(callback)

  const remove = () => {
    subscriptions.delete(callback)
    onCleanup()
  }

  return remove
}

export function triggerSubscription(state: StateTree) {
  subscriptions.forEach((callback) => callback(state))
}
