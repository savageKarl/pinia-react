import type { _Method } from './types'

export const noop = () => {}

export function addSubscription<T extends _Method>(
  subscriptions: Set<T>,
  callback: T,
  // biome-ignore lint/correctness/noUnusedFunctionParameters: <todo>
  detached?: boolean,
  onCleanup: () => void = noop
) {
  subscriptions.add(callback)

  const removeSubscription = () => {
    subscriptions.delete(callback)
    onCleanup()
  }

  return removeSubscription
}

export function triggerSubscriptions<T extends _Method>(subscriptions: Set<T>, ...args: Parameters<T>) {
  subscriptions.forEach((callback) => {
    callback(...args)
  })
}
