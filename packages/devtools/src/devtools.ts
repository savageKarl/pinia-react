import type { MutationEvent, PiniaPlugin } from 'pinia-react'
import type { DevtoolsPluginOptions } from './types'

type DevToolsConnection = {
  init(state: unknown): void
  send(action: { type: string; payload?: unknown }, state: unknown): void
  subscribe(listener: (message: any) => void): void
}

type DevToolsExtension = {
  connect(options: { name: string; trace?: boolean }): DevToolsConnection
}

const DEVTOOLS_ORIGIN = '@pinia-react/devtools'

function getExtension(): DevToolsExtension | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as typeof window & { __REDUX_DEVTOOLS_EXTENSION__?: DevToolsExtension }).__REDUX_DEVTOOLS_EXTENSION__
}

function actionFor(event: MutationEvent) {
  switch (event.meta.type) {
    case 'action':
      return { type: event.meta.action ?? '@action', payload: { args: event.meta.args, patches: event.patches } }
    case 'patch':
      return { type: '@patch', payload: event.patches }
    case 'reset':
      return { type: '@reset', payload: event.patches }
    case 'restore':
      return { type: '@restore', payload: event.patches }
  }
}

function readState(message: any): unknown {
  if (message.payload?.type === 'IMPORT_STATE') {
    const states = message.payload?.nextLiftedState?.computedStates
    return states?.[states.length - 1]?.state
  }
  if (typeof message.state === 'string') {
    try {
      return JSON.parse(message.state)
    } catch {
      return undefined
    }
  }
  return message.state
}

export function devtoolsPlugin(pluginOptions: DevtoolsPluginOptions = {}): PiniaPlugin {
  return (context) => {
    const options = context.options.devtools
    const extension = getExtension()
    if (!options?.enabled || !extension) return

    const name = pluginOptions.name
      ? `${pluginOptions.name}: ${options.name ?? context.id}`
      : (options.name ?? context.id)
    const connection = extension.connect({ name, trace: options.trace })
    connection.init(context.store.$state)

    context.pinia.onMutation((event) => {
      if (event.storeId !== context.id || event.meta.origin === DEVTOOLS_ORIGIN) return
      connection.send(actionFor(event), event.state)
    })

    connection.subscribe((message) => {
      if (message?.type !== 'DISPATCH') return

      const type = message.payload?.type
      if (type === 'COMMIT') {
        connection.init(context.store.$state)
        return
      }
      if (type === 'RESET') {
        context.restoreState(context.options.state(), { type: 'reset', origin: DEVTOOLS_ORIGIN })
        return
      }
      if (!['JUMP_TO_STATE', 'JUMP_TO_ACTION', 'ROLLBACK', 'IMPORT_STATE'].includes(type)) return

      const state = readState(message)
      if (!state || typeof state !== 'object') return
      context.restoreState(state as typeof context.store.$state, { origin: DEVTOOLS_ORIGIN })
    })
  }
}
