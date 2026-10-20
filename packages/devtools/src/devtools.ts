import type { MutationEvent, PiniaPlugin } from 'pinia-react'
import type { DevtoolsPluginOptions } from './types'

type DevToolsConnection = {
  init(state: unknown): void
  send(action: { type: string; payload?: unknown }, state: unknown): void
  subscribe(listener: (message: any) => void): (() => void) | void
  unsubscribe?(): void
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
    let connection: DevToolsConnection
    try {
      connection = extension.connect({ name, trace: options.trace })
    } catch {
      try {
        console.warn('[pinia-react/devtools] Redux DevTools connection failed.')
      } catch {
        // Host logging is optional too.
      }
      return
    }

    let active = true
    let stopMutation: (() => void) | undefined
    let stopMessages: (() => void) | undefined
    let connectionClosed = false
    let warned = false
    const fail = (phase: 'initialize' | 'send' | 'subscribe') => {
      if (!active) return
      active = false
      const mutationStop = stopMutation
      stopMutation = undefined
      try {
        mutationStop?.()
      } catch {
        // A failed optional integration must not interrupt business dispatch.
      }
      const messageStop = stopMessages
      stopMessages = undefined
      try {
        messageStop?.()
      } catch {
        // A failed optional integration must not interrupt business dispatch.
      }
      try {
        closeConnection()
      } catch {
        // A failed optional integration must not interrupt business dispatch.
      }
      if (warned) return
      warned = true
      try {
        console.warn(`[pinia-react/devtools] Redux DevTools ${phase} failed; integration disabled.`)
      } catch {
        // Host logging is optional too.
      }
    }
    const closeConnection = () => {
      if (connectionClosed) return
      connectionClosed = true
      connection.unsubscribe?.()
    }
    context.onDispose?.(() => {
      active = false
      closeConnection()
    })

    try {
      connection.init(context.store.$state)
    } catch {
      fail('initialize')
      return
    }
    if (!active) return

    stopMutation = context.pinia.onMutation((event) => {
      if (
        !active ||
        event.store !== context.store ||
        event.storeId !== context.id ||
        event.meta.origin === DEVTOOLS_ORIGIN
      )
        return
      try {
        connection.send(actionFor(event), event.state)
      } catch {
        fail('send')
      }
    })
    context.onDispose?.(() => {
      active = false
      stopMutation?.()
    })

    try {
      const unsubscribeMessages = connection.subscribe((message) => {
        if (!active || context.pinia._s.get(context.id) !== context.store || message?.type !== 'DISPATCH') return

        const type = message.payload?.type
        if (type === 'COMMIT') {
          try {
            connection.init(context.store.$state)
          } catch {
            fail('initialize')
          }
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
      stopMessages = typeof unsubscribeMessages === 'function' ? unsubscribeMessages : undefined
    } catch {
      fail('subscribe')
      return
    }
    if (typeof stopMessages === 'function') {
      if (!active) {
        stopMessages()
        return
      }
      context.onDispose?.(() => {
        active = false
        stopMessages?.()
      })
    }
  }
}
