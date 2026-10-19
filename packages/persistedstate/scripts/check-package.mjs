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
  for (const name of ['pinia-react', '@pinia-react/persistedstate', '@pinia-react/devtools']) {
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
assert.throws(() => { store.count = 99 }, /read-only/)
assert.equal(store.count, 5)
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
const stopCalls = []
let sent = 0, dispatch
const connection = { init() {}, send() { sent++ }, subscribe(listener) { dispatch = listener; return () => stopCalls.push('subscribe') }, unsubscribe() { stopCalls.push('connection') } }
globalThis.window = { __REDUX_DEVTOOLS_EXTENSION__: { connect() { return connection }, disconnect() { throw new Error('Must not disconnect all connections') } } }
const owner = createPinia().use(devtoolsPlugin()).use(({ onDispose }) => {
  assert.equal(typeof onDispose, 'function')
  const cancel = onDispose(() => stopCalls.push('cancelled'))
  cancel()
  onDispose(() => stopCalls.push('plugin'))
})
const tools = defineStore('tools', { state: () => ({ count: 0 }), devtools: { enabled: true } }).getStore(owner)
tools.$patch({ count: 1 })
assert.equal(sent, 1)
dispatch({ type: 'DISPATCH', payload: { type: 'JUMP_TO_STATE' }, state: '{"count":2}' })
assert.equal(tools.count, 2)
assert.equal(owner.state.tools.count, 2)
assert.equal(sent, 1, 'Restores must not echo back to DevTools')
const patch = tools.$patch
const persist = store.$persist
disposePinia(owner)
disposePinia(owner)
assert.deepEqual(stopCalls, ['plugin', 'subscribe', 'connection'])
assert.throws(() => patch({ count: 1 }), /disposed/)
disposePinia(pinia)
assert.throws(() => persist(), /disposed/)
assert.equal(values.get('consumer'), '{"count":6}')
delete globalThis.window
const isolated = createPinia().use(({ id, restoreState }) => {
  if (id === 'packed-isolation') restoreState({ count: 4 })
})
const definition = defineStore('packed-isolation', {
  state: () => ({ count: 0 }),
  actions: { add(n) { this.count += n; return this.count }, outer(n) { return this.add(n) } }
})
const isolatedStore = definition.getStore(isolated)
assert.equal(isolatedStore.outer(2), 6)
const unrelated = createPinia()
assert.equal(definition.getStore(unrelated).count, 0)
function Bound() {
  return createElement('span', null, definition.useStore().count)
}
assert.equal(renderToString(createElement(NextProvider, { pinia: isolated }, createElement(Bound))), '<span>4</span>', 'SSR uses the supplied instance post-plugin snapshot, not its later live state')
assert.equal(getActivePinia(), unrelated)
assert.throws(() => renderToString(createElement(NextProvider, { pinia: isolated, plugins: [] }, createElement(Bound))), /supplied Pinia/)
isolatedStore.$reset()
assert.equal(isolatedStore.add(1), 1)
const captured = isolatedStore.add
disposePinia(isolated)
assert.equal(getActivePinia(), unrelated)
assert.throws(() => captured(1), /disposed/)
disposePinia(unrelated)
// Plugins still accept the context supplied by the published core without lifecycle registration.
globalThis.window = { __REDUX_DEVTOOLS_EXTENSION__: { connect() { return connection } } }
const legacy = createPinia().use(context => {
  const { onDispose, ...published } = context
  createPersistedState({ storage })(published)
  return devtoolsPlugin()(published)
})
values.set('legacy', '{"count":7}')
const legacyStore = defineStore('legacy', { state: () => ({ count: 0 }), persist: true, devtools: { enabled: true } }).getStore(legacy)
assert.equal(legacyStore.count, 7)
legacyStore.$patch({ count: 8 })
assert.equal(values.get('legacy'), '{"count":8}')
assert.equal(sent, 2)
dispatch({ type: 'DISPATCH', payload: { type: 'JUMP_TO_STATE' }, state: '{"count":9}' })
assert.equal(legacyStore.count, 9)
assert.equal(values.get('legacy'), '{"count":9}')
assert.equal(sent, 2, 'Published-context restores must preserve origin filtering too')
disposePinia(legacy)
delete globalThis.window
const symbolKey = Symbol('business-field')
const rejectedOwner = createPinia()
const invalid = defineStore('unsupported-symbol', { state: () => ({ nested: { [symbolKey]: 1 } }) })
assert.throws(() => invalid.getStore(rejectedOwner), /symbol/i)
assert.equal(rejectedOwner.state['unsupported-symbol'], undefined)
const ordinary = defineStore('ordinary-state', { state: () => ({ count: 1, items: [1, 2], nested: { value: 0 } }) }).getStore(rejectedOwner)
assert.deepEqual([...ordinary.items], [1, 2])
assert.throws(() => ordinary.$patch(draft => { draft.count = 9; draft.nested = { [symbolKey]: 1 } }), /symbol/i)
assert.equal(ordinary.count, 1)
assert.deepEqual(ordinary.nested, { value: 0 })
disposePinia(rejectedOwner)
`
  const esm = `import assert from 'node:assert/strict'
import { createPinia, defineStore, disposePinia, getActivePinia, PiniaProvider } from 'pinia-react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { devtoolsPlugin } from '@pinia-react/devtools'
import { PiniaProvider as NextProvider } from 'pinia-react/next'
import persistedState, { createPersistedState } from '@pinia-react/persistedstate'
import { createCookiePersistedState, readCookieSnapshot } from '@pinia-react/persistedstate/next'
${body}`
  const cjs = `const assert = require('node:assert/strict')
const { createPinia, defineStore, disposePinia, getActivePinia, PiniaProvider } = require('pinia-react')
const { createElement } = require('react')
const { renderToString } = require('react-dom/server')
const { devtoolsPlugin } = require('@pinia-react/devtools')
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
  const types = `import { createPinia, defineStore, disposePinia, type PiniaProviderProps } from 'pinia-react'
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
const owner = createPinia().use(({ onDispose }) => {
  const cancel: (() => void) | undefined = onDispose?.(() => {})
  cancel?.()
})
const disposed: void = disposePinia(owner)
void disposed
void next
// @ts-expect-error Optional methods cannot be called without narrowing.
store.$persist()
// @ts-expect-error Async storage is not supported.
createPersistedState({ storage: { getItem: async () => '', setItem() {} } })
// @ts-expect-error Async deserialization is also unsupported.
createPersistedState({ serializer: { serialize: JSON.stringify, deserialize: async () => ({}) } })
`
  const contextTypes = `import { createPinia, defineStore, type PiniaPluginContext, type PiniaProviderProps } from 'pinia-react'
import { type PiniaProviderProps as NextProps } from 'pinia-react/next'
import { createPersistedState } from '@pinia-react/persistedstate'
import { devtoolsPlugin } from '@pinia-react/devtools'
import type { MutationEvent, StatePath as CoreStatePath } from 'pinia-react'
import type { Patch } from 'immer'
interface ExtendedProps extends PiniaProviderProps { appName?: string }
const definition = defineStore('packed-type-test', {
  state: () => ({ count: 0, nested: { name: '' } }),
  getters: { double: s => s.count * 2 },
  actions: { add(n: number) { this.count += n; return this.count }, async load(id: string) { return id.length }, echo<T>(value: T): T { return value } }
})
const pinia = createPinia()
const store = definition.getStore(pinia)
const statePath: CoreStatePath = ['nested', 'name']
const legacyPath: string[] = statePath
function legacyPatches(event: MutationEvent): Patch[] { return event.patches }
pinia.onMutation(event => { const patches: Patch[] = event.patches; void patches })
store.$subscribe((_state, _previous, event) => { if (event) { const patches: Patch[] = event.patches; void patches } })
void legacyPath; void legacyPatches
const same: ReturnType<typeof definition.useStore> = store
const result: Promise<number> = same.load('id')
const generic: string = same.echo('value')
const main: ExtendedProps = { pinia, children: null }
const next: NextProps = main
function publishedContext(context: PiniaPluginContext) {
  const { onDispose, ...published } = context
  const compatible: PiniaPluginContext = published
  createPersistedState()(compatible)
  devtoolsPlugin()(compatible)
}
// @ts-expect-error explicit instances must be Pinia
 definition.getStore({})
// @ts-expect-error Action retains parameter types
 store.add('bad')
// @ts-expect-error the public snapshot is readonly
 store.$state.count = 2
void result; void generic; void next; void publishedContext
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
    writeFileSync(join(consumer, `context.${extension}`), contextTypes)
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
    'Packed consumers passed: ESM, CJS, strict NodeNext .mts/.cts declarations, main/next Context, active Pinia and disposal identity; published plugin Context compatibility; no source aliases or bundled core.'
  )
} finally {
  // Delete only this check's verified, directly-created temporary directory.
  assert.equal(dirname(consumer), temporaryRoot)
  assert.ok(basename(consumer).startsWith('pinia-react-consumer-'))
  rmSync(consumer, { recursive: true, force: true })
}
