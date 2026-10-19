import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { cpus, release, totalmem } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const require = createRequire(join(root, 'package.json'))
const vitest = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
mkdirSync(join(root, 'dist'), { recursive: true })
const output = mkdtempSync(join(root, 'dist/comparison-'))
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stdout + '\n' + result.stderr)
  return result.stdout
}
function git(args) {
  return run('git', ['-c', 'safe.directory=' + root.replaceAll('\\', '/').replace(/\/$/, ''), ...args])
}
const revisions = (process.argv.slice(2).length ? process.argv.slice(2) : ['ae04b50', 'b89b8b2']).map((ref) => {
  assert.match(ref, /^[a-zA-Z0-9/_-]+$/)
  return git(['rev-parse', '--verify', ref + '^{commit}']).trim()
})
assert.equal(revisions.length, 2, 'Supply exactly a baseline and candidate revision')
const sources = revisions.map((revision) => {
  const directory = join(output, revision)
  const files = git(['ls-tree', '-r', '--name-only', revision, '--', 'packages/pinia/src']).trim().split('\n')
  assert.ok(files.length > 0)
  for (const file of files) {
    assert.ok(file.startsWith('packages/pinia/src/') && !file.includes('..'))
    const target = join(directory, relative('packages/pinia/src', file))
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, git(['show', revision + ':' + file]))
  }
  return directory
})
console.log('Same harness comparison; reports and read-only historical source snapshots:', output)
for (let round = 0; round < 3; round++) {
  for (const index of round % 2 ? [1, 0] : [0, 1]) {
    const prefix = join(output, 'round-' + round + '-' + revisions[index].slice(0, 7))
    const env = { ...process.env, PINIA_SOURCE_ROOT: sources[index], PINIA_BENCH_REPORT: prefix + '-react.json' }
    const react = run(
      process.execPath,
      [vitest, 'run', '--config', 'vitest.compat.config.ts', 'packages/playground/react/tests/tracking.spec.tsx'],
      env
    )
    writeFileSync(prefix + '-react.log', react)
    const raw = run(
      process.execPath,
      [
        vitest,
        'bench',
        '--run',
        '--config',
        'vitest.compat.config.ts',
        'packages/playground/react/tests/comparison.bench.ts',
        '--outputJson',
        prefix + '-raw.json'
      ],
      env
    )
    writeFileSync(prefix + '-raw.log', raw)
    console.log('Passed', round, revisions[index].slice(0, 7))
  }
}
writeFileSync(
  join(output, 'environment.json'),
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      os: release(),
      cpu: cpus()[0].model,
      memory: totalmem(),
      vitest: require('vitest/package.json').version,
      harnessHash: createHash('sha256')
        .update(
          [
            'vitest.compat.config.ts',
            'packages/playground/react/tests/tracking.spec.tsx',
            'packages/playground/react/tests/comparison.bench.ts'
          ]
            .map((file) => readFileSync(join(root, file), 'utf8'))
            .join('\n')
        )
        .digest('hex'),
      revisions,
      react: JSON.parse(readFileSync(join(output, 'round-0-' + revisions[0].slice(0, 7) + '-react.json'), 'utf8'))
        .react,
      rounds: 3,
      order: ['AB', 'BA', 'AB']
    },
    null,
    2
  )
)
console.log('Comparison finished:', output)
