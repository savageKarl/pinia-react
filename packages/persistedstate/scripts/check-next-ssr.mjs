import assert from 'node:assert/strict'

// Run after building the Next.js playground and starting it on port 4174.
// Synthetic preference cookies only; no browser profile or user cookies are read.
const base = process.argv[2] ?? 'http://127.0.0.1:4174'
const defaults = { name: 'Ada', theme: 'light' }
const checks = [
  { name: 'Server Ada', theme: 'dark' },
  { name: 'literal%20 and %25', theme: 'light' },
  { name: '你好，世界', theme: 'dark' }
]
function readPreferences(html) {
  return {
    name: html.match(/<strong data-testid="preference-name">([^<]*)<\/strong>/)?.[1],
    theme: html.match(/class="profile-preview" data-theme="([^"]*)"/)?.[1]
  }
}
async function request(value, expected) {
  const response = await fetch(new URL('/preferences', base), {
    headers: { Cookie: `pinia%3Apreferences=${encodeURIComponent(value)}; unrelated-secret=private` }
  })
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.deepEqual(readPreferences(html), expected)
  assert.ok(
    !html.includes('unrelated-secret') && !html.includes('private'),
    'Only allowlisted preferences may cross to client props'
  )
  assert.ok(!response.headers.has('set-cookie'), 'Rendering must never set response cookies')
  return expected
}
const results = await Promise.all([
  ...checks.map((state) => request(JSON.stringify({ ...state, note: 'MUST_NOT_BE_RESTORED' }), state)),
  request('broken-json', defaults),
  request('{"__proto__":{"polluted":true}}', defaults)
])
const missing = await fetch(new URL('/preferences', base))
assert.equal(missing.status, 200)
assert.deepEqual(readPreferences(await missing.text()), defaults)
console.log(
  'Next.js production SSR passed: 6 requests, isolated state, first HTML, URI data, invalid payloads, allowlist and no response writes.',
  results
)
