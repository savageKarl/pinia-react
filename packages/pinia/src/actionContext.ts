import { isDisposed } from './lifecycle'
import type { MutationMeta, Pinia } from './types'

const sequences = new WeakMap<Pinia, number>()
const activeActions = new WeakMap<Pinia, MutationMeta>()

export function clearActionContext(pinia: Pinia): void {
  sequences.delete(pinia)
  activeActions.delete(pinia)
}

export function createActionMeta(
  pinia: Pinia,
  action: string,
  args: unknown[],
  parent = activeActions.get(pinia)
): MutationMeta {
  const sequence = (sequences.get(pinia) ?? 0) + 1
  sequences.set(pinia, sequence)
  return {
    type: 'action',
    action,
    args,
    actionId: String(sequence),
    ...(parent?.actionId ? { parentActionId: parent.actionId } : {})
  }
}

export function runWithAction<T>(pinia: Pinia, meta: MutationMeta, run: () => T): T {
  const previous = activeActions.get(pinia)
  activeActions.set(pinia, meta)
  try {
    return run()
  } finally {
    if (previous && !isDisposed(pinia)) activeActions.set(pinia, previous)
    else activeActions.delete(pinia)
  }
}
