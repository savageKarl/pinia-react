import { useState } from 'react'
import type { Fun } from './types'
import { noop } from './utils'

type ApiEnv = 'component' | 'js' | 'pending'

let apiExecuteEnv: ApiEnv = 'component'

function setApiEnv(env: ApiEnv) {
  apiExecuteEnv = env
}

function getApiEnv() {
  try {
    setApiEnv('pending')
    useState()
    setApiEnv('component')
  } catch (e) {
    setApiEnv('js')
  }

  return apiExecuteEnv
}

export function safeHookRun(callback: Fun, elseCallback: Fun = noop) {
  if (getApiEnv() === 'component') {
    callback()
  } else {
    elseCallback()
  }
}

export function safeRun(callback: Fun) {
  try {
    callback()
  } catch {}
}

safeRun(() => {
  const originErrorConsole = globalThis.console.error

  globalThis.console.error = function (...args: unknown[]) {
    if (apiExecuteEnv === 'pending') return undefined

    originErrorConsole(...args)
  }
})
