import type { _Method, Fn } from './types'

export const noop = () => {}

export function addSubscription<T extends _Method>(
  activeComponentCleanUp: [Fn[]],
  subscriptions: Set<T>,
  callback: T,
  detached?: boolean,
  onCleanup: () => void = noop
) {
  subscriptions.add(callback)

  const removeSubscription = () => {
    subscriptions.delete(callback)
    onCleanup()
  }

  if (!detached) {
    activeComponentCleanUp[0].push(removeSubscription)
  }

  return removeSubscription
}

export function triggerSubscriptions<T extends _Method>(subscriptions: Set<T>, ...args: Parameters<T>) {
  subscriptions.forEach((callback) => {
    callback(...args)
  })
}
