import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { cpus, release, totalmem } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { brotliCompressSync, brotliDecompressSync, constants, gunzipSync, gzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(join(root, 'package.json'))
const tools = createRequire(require.resolve('tsup/package.json'))
const { build, version: esbuild } = await import(pathToFileURL(tools.resolve('esbuild')).href)
const read = (file) => readFileSync(join(root, file), 'utf8')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const git = (...args) =>
  execFileSync('git', ['-c', 'safe.directory=' + resolve(root).split(sep).join('/'), ...args], {
    cwd: root,
    encoding: 'utf8'
  }).trim()
function sizes(bytes) {
  const gzip = gzipSync(bytes, { level: 9 })
  const brotli = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
  assert.deepEqual(gunzipSync(gzip), bytes)
  assert.deepEqual(brotliDecompressSync(brotli), bytes)
  return { raw: bytes.length, gzip: gzip.length, brotli: brotli.length }
}
assert.equal(sizes(Buffer.from('self-check')).raw, 10)
const bundles = []
for (const directory of ['pinia', 'devtools', 'persistedstate']) {
  const manifest = JSON.parse(read('packages/' + directory + '/package.json'))
  const external = [
    ...new Set([...Object.keys(manifest.dependencies || {}), ...Object.keys(manifest.peerDependencies || {})])
  ].sort()
  for (const format of ['esm', 'cjs']) {
    const entry = 'packages/' + directory + '/dist/index.' + (format === 'esm' ? 'js' : 'cjs')
    const output = await build({
      entryPoints: [join(root, entry)],
      bundle: true,
      write: false,
      minify: true,
      treeShaking: true,
      platform: 'browser',
      target: 'es2020',
      format,
      external,
      metafile: true,
      legalComments: 'none',
      define: { 'process.env.NODE_ENV': '"production"' }
    })
    const bytes = Buffer.from(output.outputFiles[0].contents)
    const result = sizes(bytes)
    assert.ok(result.raw > 0 && result.gzip > 0 && result.brotli > 0)
    assert.ok(
      Object.values(output.metafile.outputs)
        .flatMap((value) => value.imports)
        .every((value) => value.external)
    )
    bundles.push({
      package: manifest.name,
      format,
      entry,
      external,
      manifestSha256: hash(read('packages/' + directory + '/package.json')),
      buildConfigSha256: hash(read('packages/' + directory + '/tsup.config.ts')),
      inputSha256: hash(read(entry)),
      bundleSha256: hash(bytes),
      bytes: result
    })
  }
}
const roles = [
  ['shared rules / synthetic request', 'packages/playground/shared/checkoutDomain.ts'],
  ['Pinia state / getters / Actions / plugin options', 'packages/playground/shared/checkoutStores.ts'],
  ['shared form / Pinia binding / shared observer', 'packages/playground/shared/Checkout.tsx'],
  ['Zustand state / derived reads / actions', 'packages/playground/react/src/checkoutZustand.ts'],
  ['comparison / Zustand React binding', 'packages/playground/react/src/CheckoutComparison.tsx'],
  ['runtime / equivalent input / isolation tests', 'packages/playground/react/tests/checkout.spec.tsx'],
  ['Next business SSR / hydration / cookie test', 'packages/playground/nextjs/tests/checkout.spec.tsx']
].map(([role, file]) => {
  const text = read(file)
  const lines = text.trimEnd().split(/\r?\n/)
  return { role, file, lines: lines.length, nonblank: lines.filter((line) => line.trim()).length, sha256: hash(text) }
})
assert.equal(roles.length, 7)
const report = {
  schema: 1,
  lockfileSha256: hash(read('pnpm-lock.yaml')),
  harnesses: [
    'scripts/measure-bundles.mjs',
    'packages/playground/react/scripts/check-checkout.mjs',
    'packages/playground/react/tests/comparison.bench.ts',
    'packages/playground/react/tests/tracking.spec.tsx'
  ].map((file) => ({ file, sha256: hash(read(file)) })),
  measuredAt: new Date().toISOString(),
  baseCommit: git('rev-parse', 'HEAD'),
  workingTree: git('status', '--short'),
  environment: {
    node: process.version,
    pnpm: process.env.npm_config_user_agent || 'run via pnpm for package-manager provenance',
    react: require('react/package.json').version,
    typescript: require('typescript/package.json').version,
    esbuild,
    vitest: require('vitest/package.json').version,
    tsup: require('tsup/package.json').version,
    next: createRequire(join(root, 'packages/playground/nextjs/package.json'))('next/package.json').version,
    zustand: createRequire(join(root, 'packages/playground/react/package.json'))('zustand/package.json').version,
    zlib: process.versions.zlib,
    brotli: process.versions.brotli,
    platform: process.platform,
    arch: process.arch,
    os: release(),
    cpu: cpus()[0].model,
    memory: totalmem()
  },
  method:
    'Minified production primary entry, all exports retained; external runtime/peer dependencies excluded. ESM supports consumer tree-shaking; CJS does not promise equivalent elimination. No maps, declarations, tarballs, Next subpath or app assets. gzip level 9, brotli quality 11. Compression round-trip self-checks run for every output.',
  bundles,
  roles
}
const destination = join(root, 'dist/measurements')
mkdirSync(destination, { recursive: true })
writeFileSync(join(destination, 'bundles.json'), JSON.stringify(report, null, 2) + '\n')
console.table(bundles.map(({ package: name, format, bytes }) => ({ name, format, ...bytes })))
console.table(roles.map(({ role, lines, nonblank }) => ({ role, lines, nonblank })))
console.log('Self-checks passed; dist/measurements/bundles.json')
