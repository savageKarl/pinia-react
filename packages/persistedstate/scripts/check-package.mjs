import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDocs } from './check-docs.mjs'
import { checkEditor } from './check-editor.mjs'

// Run from the repository root after building the core and plugin, via pnpm.
const root = fileURLToPath(new URL('../../../', import.meta.url))
const requireRoot = createRequire(join(root, 'package.json'))
const requireCore = createRequire(join(root, 'packages/pinia/package.json'))
const pnpm = process.env.npm_execpath
assert.ok(pnpm, 'Run this check using pnpm --filter @pinia-react/persistedstate test-package')
const temporaryRoot = realpathSync(tmpdir())
const consumer = mkdtempSync(join(temporaryRoot, 'pinia-react-consumer-'))

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', env: process.env })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`)
  return result.stdout
}
function linkDependency(name, from = requireRoot) {
  const target = join(consumer, 'node_modules', name)
  mkdirSync(dirname(target), { recursive: true })
  symlinkSync(dirname(from.resolve(`${name}/package.json`)), target, process.platform === 'win32' ? 'junction' : 'dir')
}

try {
  for (const name of ['pinia-react', '@pinia-react/persistedstate']) {
    const previous = new Set(readdirSync(consumer))
    run(process.execPath, [pnpm, '--filter', name, 'pack', '--pack-destination', consumer])
    const archive = readdirSync(consumer).find((file) => file.endsWith('.tgz') && !previous.has(file))
    assert.ok(archive, `Missing packed archive for ${name}`)
    const target = join(consumer, 'node_modules', name)
    mkdirSync(target, { recursive: true })
    run('tar', ['-xzf', join(consumer, archive), '-C', target, '--strip-components', '1'])
  }
  for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom', '@types/node']) linkDependency(name)
  linkDependency('immer', requireCore)
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  const body = `
const values = new Map([['consumer', '{"count":4}']])
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
const pinia = createPinia().use(createPersistedState({ storage }))
const { getConsumerStore } = defineStore('consumer', { state: () => ({ count: 0 }), persist: true, getters: { double: s => s.count * 2 } })
const store = getConsumerStore()
assert.equal(store.double, 8)
store.$patch({ count: 5 })
assert.equal(values.get('consumer'), '{"count":5}')
assert.equal(pinia.state.consumer.count, 5)
values.set('consumer', '{"count":6}')
store.$hydrate()
assert.equal(store.double, 12)
assert.equal(PiniaProvider, NextProvider)
assert.equal(typeof persistedState, 'function')
const cookieSnapshot = readCookieSnapshot({ get: () => ({ value: '{"count":9}' }) }, ['cookie-consumer'])
createPinia().use(createCookiePersistedState({ cookies: cookieSnapshot }))
const cookieStore = defineStore('cookie-consumer', { state: () => ({ count: 0 }), persist: true }).getStore()
assert.equal(cookieStore.count, 9)
cookieStore.$patch({ count: 10 })
cookieStore.$persist()
assert.equal(cookieStore.count, 10)
`
  const esm = `import assert from 'node:assert/strict'
import { createPinia, defineStore, PiniaProvider } from 'pinia-react'
import { PiniaProvider as NextProvider } from 'pinia-react/next'
import persistedState, { createPersistedState } from '@pinia-react/persistedstate'
import { createCookiePersistedState, readCookieSnapshot } from '@pinia-react/persistedstate/next'
${body}`
  const cjs = `const assert = require('node:assert/strict')
const { createPinia, defineStore, PiniaProvider } = require('pinia-react')
const { PiniaProvider: NextProvider } = require('pinia-react/next')
const { default: persistedState, createPersistedState } = require('@pinia-react/persistedstate')
const { createCookiePersistedState, readCookieSnapshot } = require('@pinia-react/persistedstate/next')
${body}`
  for (const [extension, source] of [
    ['mjs', esm],
    ['cjs', cjs]
  ]) {
    const file = join(consumer, `runtime.${extension}`)
    writeFileSync(file, source)
    run(process.execPath, [file])
  }
  const types = `import { createPinia, defineStore, type PiniaProviderProps } from 'pinia-react'
import { type PiniaProviderProps as NextProps } from 'pinia-react/next'
import persistedState, { createPersistedState, type PersistenceOptions, type StorageLike } from '@pinia-react/persistedstate'
const storage: StorageLike = { getItem: () => null, setItem: () => {} }
const persistence: PersistenceOptions<{ count: number }> = { storage, pick: ['count'], key: id => id }
createPinia().use(persistedState).use(createPersistedState({ storage, auto: true }))
const { getConsumerStore, useConsumerStore } = defineStore('consumer', { state: () => ({ count: 0 }), persist: [persistence], getters: { double: state => state.count * 2 }, actions: { add(n: number) { this.count += n } } })
const store: ReturnType<typeof useConsumerStore> = getConsumerStore()
const count: number = store.double
store.add(count)
store.$hydrate?.({ runHooks: false })
store.$persist?.()
const props: PiniaProviderProps = { plugins: [persistedState], children: null }
const next: NextProps = props
void next
// @ts-expect-error Optional methods cannot be called without narrowing.
store.$persist()
// @ts-expect-error Async storage is not supported.
createPersistedState({ storage: { getItem: async () => '', setItem() {} } })
// @ts-expect-error Async deserialization is also unsupported.
createPersistedState({ serializer: { serialize: JSON.stringify, deserialize: async () => ({}) } })
`
  const inference = readFileSync(join(root, 'packages/persistedstate/test-dts/inference.test-d.ts'), 'utf8').replace(
    "from '../src'",
    "from '@pinia-react/persistedstate'"
  )
  const paths = readFileSync(join(root, 'packages/persistedstate/test-dts/paths.test-d.ts'), 'utf8').replace(
    "from '../src'",
    "from '@pinia-react/persistedstate'"
  )
  const nextTypes = readFileSync(join(root, 'packages/persistedstate/test-dts/next.test-d.ts'), 'utf8')
  for (const extension of ['mts', 'cts']) {
    writeFileSync(join(consumer, `next.${extension}`), nextTypes)
    writeFileSync(join(consumer, `types.${extension}`), types)
    writeFileSync(join(consumer, `inference.${extension}`), inference)
    writeFileSync(join(consumer, `paths.${extension}`), paths)
  }
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext'
      },
      include: ['*.mts', '*.cts']
    })
  )
  run(process.execPath, [requireRoot.resolve('typescript/bin/tsc'), '-p', join(consumer, 'tsconfig.json')])
  checkEditor(consumer, true)
  checkDocs(consumer, true)
  const pluginBundle = readFileSync(join(consumer, 'node_modules/@pinia-react/persistedstate/dist/index.js'), 'utf8')
  assert.ok(
    !pluginBundle.includes('useSyncExternalStore') && !pluginBundle.includes('new Immer'),
    'Core must remain external'
  )
  console.log(
    'Packed consumers passed: ESM, CJS, strict NodeNext .mts/.cts declarations, main/next Provider identity; no source aliases or bundled core.'
  )
} finally {
  // Delete only this check's verified, directly-created temporary directory.
  assert.equal(dirname(consumer), temporaryRoot)
  assert.ok(basename(consumer).startsWith('pinia-react-consumer-'))
  rmSync(consumer, { recursive: true, force: true })
}
