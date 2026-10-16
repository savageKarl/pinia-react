import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflow = (name) =>
  readFileSync(new URL(`../workflows/${name}.yaml`, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const docs = workflow('deploy-docs')
const release = workflow('release')

function block(source, name) {
  const content = source.split(`\n  ${name}:\n`)[1]
  assert.ok(content, `Missing ${name} configuration`)
  return content.split(/\n {2}\S/)[0]
}

test('documentation deployment is callable and does not run on branch or release events', () => {
  assert.match(docs, /^ {2}workflow_call:/m)
  assert.doesNotMatch(docs, /^ {2}(?:push|pull_request|release|workflow_run|schedule):/m)
})

test('release forwards the actual Changesets publication result', () => {
  assert.match(block(release, 'publish'), /^ {6}published: \$\{\{ steps\.changesets\.outputs\.published \}\}$/m)
})

test('automatic documentation deployment requires a successful publication', () => {
  const deploy = block(release, 'deploy-docs')
  assert.match(deploy, /^ {4}needs: publish$/m)
  assert.match(deploy, /^ {4}if: \$\{\{ needs\.publish\.outputs\.published == 'true' \}\}$/m)
  assert.match(deploy, /^ {4}uses: \.\/\.github\/workflows\/deploy-docs\.yaml$/m)
  assert.match(deploy, /^ {6}contents: read$/m)
  assert.match(deploy, /^ {6}pages: write$/m)
  assert.match(deploy, /^ {6}id-token: write$/m)
})

test('deployment checks out the publication commit or an explicitly selected manual revision', () => {
  const manual = block(docs, 'workflow_dispatch')
  assert.match(manual, /^ {6}ref:\n(?: {8}[^\n]*\n)* {8}required: true$/m)
  assert.match(block(docs, 'build'), /^ {10}ref: \$\{\{ inputs\.ref \|\| github\.sha \}\}$/m)
})
