import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const names = ['index', 'configuration', 'advanced', 'typescript', 'limitations', 'nextjs']
const requireNext = createRequire(join(root, 'packages/playground/nextjs/package.json'))
const nextHeaders = requireNext.resolve('next/headers').replace(/\.js$/, '.d.ts')
const normalize = (name) => resolve(name).replaceAll('\\', '/')

function examples(language, page) {
  const document = join(
    root,
    `packages/docs/docs/${language}/guide/plugins/${page === 'index' ? 'persistedstate' : `persistedstate/${page}`}.md`
  )
  const text = readFileSync(document, 'utf8')
  const blocks = [...text.matchAll(/^```(tsx?|json)(?: title="([^"]+)")?\r?\n([\s\S]*?)^```/gm)]
  const files = new Map()
  for (const [, language, title, source] of blocks) {
    if (language === 'json') {
      JSON.parse(source)
      continue
    }
    assert.ok(title?.endsWith(`.${language}`), `${document}: TS/TSX examples need a filename`)
    assert.ok(!files.has(title), `${document}: duplicate example ${title}`)
    assert.ok(
      !source.includes('@ts-ignore') && !source.includes('@ts-nocheck'),
      `${document}: do not bypass example checks`
    )
    files.set(title, source)
  }
  assert.ok(files.size, `${document}: no checked examples found`)
  return files
}

/** Compile actual guide fences, with no source aliases in the packed-package run. */
export function checkDocs(directory = root, packed = false) {
  let count = 0
  for (const page of names) {
    const english = examples('en', page)
    const chinese = examples('zh', page)
    assert.deepEqual([...english.keys()], [...chinese.keys()], `${page}: bilingual example filenames differ`)
    for (const [name, source] of english) {
      const emit = (text) =>
        ts.transpileModule(text, {
          fileName: name,
          compilerOptions: { target: ts.ScriptTarget.ES2022, removeComments: true, jsx: ts.JsxEmit.ReactJSX }
        }).outputText
      assert.equal(emit(chinese.get(name)), emit(source), `${page}/${name}: bilingual examples diverged`)
    }
    for (const [language, files] of [
      ['en', english],
      ['zh', chinese]
    ]) {
      const virtual = new Map(
        [...files].map(([name, text]) => [normalize(join(directory, '__docs', language, page, name)), text])
      )
      const directories = new Set()
      for (const name of virtual.keys()) {
        let parent = normalize(dirname(name))
        while (!directories.has(parent)) {
          directories.add(parent)
          const next = normalize(dirname(parent))
          if (next === parent) break
          parent = next
        }
      }
      const options = {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        types: [],
        ...(packed
          ? { paths: { 'next/headers': [nextHeaders] } }
          : {
              baseUrl: root,

              paths: {
                'next/headers': [nextHeaders],
                'pinia-react': ['packages/pinia/src/index.ts'],
                '@pinia-react/persistedstate': ['packages/persistedstate/src/index.ts'],
                '@pinia-react/persistedstate/next': ['packages/persistedstate/src/next.ts'],
                'pinia-react/next': ['packages/pinia/src/next.ts']
              }
            })
      }
      const host = ts.createCompilerHost(options)
      const { readFile, fileExists, directoryExists } = host
      host.readFile = (name) => virtual.get(normalize(name)) ?? readFile(name)
      host.fileExists = (name) => virtual.has(normalize(name)) || fileExists(name)
      host.directoryExists = (name) => directories.has(normalize(name)) || directoryExists(name)
      const program = ts.createProgram([...virtual.keys()], options, host)
      // Validate examples and our declarations strictly. Next.js ships build-template declarations
      // with unresolved placeholders; those are checked by Next's own production build instead.
      // Do not suppress diagnostics in our source, packed declarations or example files.
      const frameworkRoot = normalize(dirname(nextHeaders)) + '/'
      const knownNextDiagnostics = new Set([
        'dist/build/templates/app-page.d.ts:2307',
        'dist/build/webpack-config.d.ts:2694',
        'dist/build/webpack/loaders/next-app-loader/index.d.ts:2694',
        'dist/export/types.d.ts:7016',
        'dist/lib/worker.d.ts:7016',
        'dist/server/app-render/entry-base.d.ts:2307',
        'dist/server/app-render/types.d.ts:7016'
      ])
      const upstream = []
      const diagnostics = ts.getPreEmitDiagnostics(program).filter((diagnostic) => {
        if (
          page === 'nextjs' &&
          diagnostic.file?.isDeclarationFile &&
          normalize(diagnostic.file.fileName).startsWith(frameworkRoot) &&
          knownNextDiagnostics.has(
            `${normalize(diagnostic.file.fileName).slice(frameworkRoot.length)}:${diagnostic.code}`
          )
        ) {
          upstream.push(diagnostic)
          return false
        }
        return true
      })
      if (upstream.length && language === 'en')
        console.log(
          `Next.js examples: ${upstream.length} upstream framework declaration diagnostics excluded; example and plugin diagnostics remain strict. Run the Next.js production build too.`
        )
      assert.equal(
        diagnostics.length,
        0,
        ts.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCanonicalFileName: (name) => name,
          getCurrentDirectory: () => directory,
          getNewLine: () => '\n'
        })
      )
      count += virtual.size
    }
  }
  console.log(
    `Documentation examples passed (${packed ? 'packed declarations' : 'source'}): ${count} TS/TSX files across ${names.length * 2} bilingual pages; matching examples and valid JSON.`
  )
}

/** Check the emitted landing URLs, nested navigation and local fragment targets. */
export async function checkRenderedDocs() {
  const { JSDOM } = await import('jsdom')
  const output = join(root, 'packages/docs/doc_build')
  let links = 0
  const documents = new Map()
  try {
    const documentAt = (path) => {
      if (!documents.has(path)) {
        assert.ok(existsSync(path), `Missing rendered page: ${path}`)
        documents.set(path, new JSDOM(readFileSync(path, 'utf8')))
      }
      return documents.get(path).window.document
    }
    for (const lang of ['', 'zh/']) {
      for (const name of names) {
        const relative = `${lang}guide/plugins/persistedstate${name === 'index' ? '' : `/${name}`}.html`
        const doc = documentAt(join(output, relative))
        assert.ok(doc.querySelector('h1'), `Missing heading: ${relative}`)
        const entries = [...doc.querySelectorAll('a[href]')]
        for (const name of names.slice(1)) {
          assert.ok(
            entries.some(
              (a) => a.getAttribute('href') === `/pinia-react/${lang}guide/plugins/persistedstate/${name}.html`
            ),
            `Missing navigation: ${relative} → ${name}`
          )
        }
        for (const a of entries) {
          const url = new URL(a.getAttribute('href'), `https://docs.invalid/pinia-react/${relative}`)
          if (url.origin !== 'https://docs.invalid' || !url.pathname.includes('/guide/plugins/persistedstate')) continue
          const destination = documentAt(join(output, decodeURIComponent(url.pathname.replace(/^\/pinia-react\//, ''))))
          if (url.hash)
            assert.ok(destination.getElementById(decodeURIComponent(url.hash.slice(1))), `Missing anchor: ${url.href}`)
          links++
        }
      }
    }
    console.log(
      `Rendered documentation passed: ${names.length * 2} pages, stable landing URLs, ${names.length - 1}-page navigation and ${links} local links/anchors.`
    )
  } finally {
    for (const dom of documents.values()) dom.window.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--rendered')) await checkRenderedDocs()
  else checkDocs()
}
