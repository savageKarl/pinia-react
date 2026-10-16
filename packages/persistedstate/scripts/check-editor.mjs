import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../../', import.meta.url))

/** Exercise the same completion API that TypeScript editors use, also against packed declarations. */
export function checkEditor(directory = root, packed = false) {
  const file = resolve(directory, '__persistedstate_editor.ts').replaceAll('\\', '/')
  const positions = new Map()
  const source = `
import { defineStore } from 'pinia-react'
import { createPersistedState } from '@pinia-react/persistedstate'
import { createCookiePersistedState } from '@pinia-react/persistedstate/next'
interface Node { label: string; next?: Node }
const { getEditorStore } = defineStore('editor', {
  state: (): { count: number; profile?: { name: string }; selected: { first: string } | { second: number } | null; items: readonly { name: string }[]; date: Date; node: Node; dictionary: Record<string, { value: number }> } => ({ count: 0, selected: null, items: [], date: new Date(), node: { label: 'root' }, dictionary: {} }),
  getters: { double: s => s.count * 2 },
  actions: { increment(amount: number) { this.count += amount; return this.count } },
  persist: {
    pick: ['/*pick*/'], omit: ['/*omit*/'],
    beforeHydrate({ store }) { store./*hook*/count; store.profile?./*nested*/name },
    afterHydrate({ store }) { store./*after*/increment(1) },
    onHydrateError(_error, store) { store./*hydrateError*/double },
    onPersistError(_error, store) { store./*persistError*/increment(1) }
  }
})
const array = defineStore('array', {
  state: () => ({ settings: { theme: 'light' }, count: 0 }),
  getters: { doubled: s => s.count * 2 },
  actions: { add(amount: number) { this.count += amount } },
  persist: [{ pick: ['/*arrayPick*/'], afterHydrate({ store }) { store./*arrayHook*/doubled } }, { omit: ['/*arrayOmit*/'], onPersistError(_error, store) { store./*arrayError*/add(1) } }]
})
defineStore('options', { state: () => ({ count: 0 }), persist: { /*storeOptions*/key: 'options' } })
createPersistedState({ /*globalOptions*/auto: true })
createCookiePersistedState({ /*cookieOptions*/cookies: {} })
createCookiePersistedState({ cookies: {}, cookieOptions: { /*attributes*/path: '/' } })
getEditorStore()./*alias*/double
void array
`.replace(/\/\*([a-zA-Z]+)\*\//g, (marker, name, offset) => {
    // String.replace offsets refer to the original input, so account for all removed markers.
    const removed = [...positions.values()].reduce((total, entry) => total + entry.length, 0)
    positions.set(name, { position: offset - removed, length: marker.length })
    return ''
  })
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    target: ts.ScriptTarget.ES2022,
    module: packed ? ts.ModuleKind.NodeNext : ts.ModuleKind.ESNext,
    moduleResolution: packed ? ts.ModuleResolutionKind.NodeNext : ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    ...(packed
      ? {}
      : {
          baseUrl: root,
          paths: {
            'pinia-react': ['packages/pinia/src/index.ts'],
            '@pinia-react/persistedstate': ['packages/persistedstate/src/index.ts'],
            '@pinia-react/persistedstate/next': ['packages/persistedstate/src/next.ts']
          }
        })
  }
  const host = {
    getScriptFileNames: () => [file],
    getScriptVersion: () => '1',
    getScriptSnapshot: (name) => {
      const text = name === file ? source : ts.sys.readFile(name)
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text)
    },
    getCurrentDirectory: () => directory,
    getCompilationSettings: () => options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: (name) => name === file || ts.sys.fileExists(name),
    readFile: (name) => (name === file ? source : ts.sys.readFile(name)),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    realpath: ts.sys.realpath
  }
  const service = ts.createLanguageService(host)
  try {
    const diagnostics = [...service.getSyntacticDiagnostics(file), ...service.getSemanticDiagnostics(file)]
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => directory,
        getNewLine: () => '\n'
      })
    )
    const candidates = (name) => {
      const result = service.getCompletionsAtPosition(file, positions.get(name).position, {})
      assert.ok(result, `No completion result at ${name}`)
      return new Set(result.entries.map((entry) => entry.name))
    }
    const contains = (name, expected, excluded = []) => {
      const actual = candidates(name)
      for (const item of expected)
        assert.ok(actual.has(item), `${name}: missing ${item}; got ${[...actual].join(', ')}`)
      for (const item of excluded) assert.ok(!actual.has(item), `${name}: unexpected ${item}`)
    }
    for (const name of ['hook', 'after', 'hydrateError', 'persistError', 'alias']) {
      contains(name, ['count', 'profile', 'double', 'increment', '$hydrate', '$persist'], ['missing'])
    }
    contains('nested', ['name'], ['count'])
    for (const name of ['pick', 'omit']) {
      contains(
        name,
        [
          'count',
          'profile',
          'profile.name',
          'selected.first',
          'selected.second',
          'items',
          'date',
          'node.next.label',
          'dictionary'
        ],
        ['double', 'increment', 'items.0', 'items.length', 'items.map', 'date.getTime']
      )
    }
    for (const name of ['arrayPick', 'arrayOmit'])
      contains(name, ['settings', 'settings.theme', 'count'], ['doubled', 'add'])
    for (const name of ['arrayHook', 'arrayError']) contains(name, ['count', 'doubled', 'add'])
    contains('storeOptions', ['pick', 'omit', 'key', 'beforeHydrate', 'onPersistError'], ['auto'])
    contains('globalOptions', ['auto', 'key', 'storage', 'beforeHydrate'], ['pick', 'omit'])
    contains('cookieOptions', ['cookies', 'cookieOptions', 'auto', 'key', 'onHydrateError'], ['storage'])
    contains('attributes', ['path', 'maxAge', 'sameSite', 'secure', 'domain'], ['httpOnly'])
    console.log(
      `Editor completions passed (${packed ? 'packed declarations' : 'source'}): ${positions.size} cursor locations, store hooks/errors, paths, arrays and factory options.`
    )
  } finally {
    service.dispose()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkEditor()
