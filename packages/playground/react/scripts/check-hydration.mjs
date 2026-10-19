import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const require = createRequire(join(root, 'package.json'))
const modules = process.env.PINIA_COMPAT_MODULES || join(root, 'node_modules')
const requireReact = createRequire(resolve(modules, '../package.json'))
const requireTools = createRequire(resolve(process.env.PINIA_BROWSER_MODULES || modules, '../package.json'))
const { chromium } = requireTools('playwright')
const requireTsup = createRequire(require.resolve('tsup/package.json'))
const { build } = await import(pathToFileURL(requireTsup.resolve('esbuild')).href)
const react = dirname(requireReact.resolve('react/package.json'))
const reactDOM = dirname(requireReact.resolve('react-dom/package.json'))
const temporaryRoot = realpathSync(tmpdir())
const temporary = mkdtempSync(join(temporaryRoot, 'pinia-hydration-'))
const fixture = join(root, 'packages/playground/react/tests/browser/hydration.tsx')
const options = {
  bundle: true,
  jsx: 'automatic',
  logLevel: 'silent',
  alias: {
    react,
    'react-dom': reactDOM,
    'pinia-react': join(resolve(root, process.env.PINIA_SOURCE_ROOT || 'packages/pinia/src'), 'index.ts')
  },
  define: { 'process.env.NODE_ENV': '"development"' }
}
let browser
let server
try {
  const serverFile = join(temporary, 'server.cjs')
  await build({
    ...options,
    platform: 'node',
    format: 'cjs',
    outfile: serverFile,
    stdin: {
      contents:
        'import { createFixture } from ' +
        JSON.stringify(fixture) +
        '; import { renderToString } from "react-dom/server"; export const html = renderToString(createFixture(false).tree)',
      resolveDir: root,
      loader: 'tsx'
    }
  })
  const { html } = require(serverFile)
  assert.ok(html.includes('1|initial|2|2:initial|2:initial'), 'SSR initial snapshot and Getter chain')
  const clientFile = join(temporary, 'client.js')
  await build({
    ...options,
    platform: 'browser',
    outfile: clientFile,
    entryPoints: [join(dirname(fixture), 'hydration.client.tsx')]
  })
  const client = readFileSync(clientFile)
  server = createServer((request, response) => {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.end(
        '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="root">' +
          html +
          '</div><script src="/client.js"></script></body></html>'
      )
    } else if (request.url === '/client.js') {
      response.setHeader('Content-Type', 'text/javascript')
      response.end(client)
    } else {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready))
  browser = await chromium.launch({ headless: true, channel: process.env.PINIA_BROWSER_CHANNEL || undefined })
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(15_000)
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text() + ' ' + message.location().url)
  })
  await page.goto('http://127.0.0.1:' + server.address().port)
  await page.waitForFunction(() => document.querySelector('#update')?.textContent === '5:10:new')
  assert.equal(await page.locator('#delayed').textContent(), '1|initial|2|2:initial|2:initial')
  const initialDebug = await page.evaluate(() => window.hydrationProbe.debug)
  assert.ok(Array.isArray(initialDebug), 'The browser fixture must capture diagnostic observations')
  assert.equal(
    initialDebug.some((event) => event.type === 'dependencies' && event.label === 'Delayed'),
    false,
    'A suspended hydration render must not publish dependencies'
  )
  await page.evaluate(() => window.hydrationProbe.release())
  await page.waitForFunction(() => document.querySelector('#delayed')?.textContent === '5|new|10|10:new|10:new')
  await page.locator('#update').click()
  await page.waitForFunction(() => document.querySelector('#delayed')?.textContent === '6|new|12|12:new|12:new')
  assert.equal(await page.locator('#isolated').textContent(), '9')
  const result = await page.evaluate(() => ({
    observed: window.hydrationProbe.observed,
    recoverable: window.hydrationProbe.recoverable,
    instances: window.hydrationProbe.instances.size,
    plugins: window.hydrationProbe.plugins
  }))
  assert.ok(
    result.observed.includes('1|initial|2|2:initial|2:initial'),
    'Delayed hydration must first read the server snapshot'
  )
  assert.ok(result.observed.includes('5|new|10|10:new|10:new'))
  assert.equal(result.instances, 2)
  assert.equal(result.plugins.filter((id) => id === 'browser-hydration').length, 2)
  assert.deepEqual(result.recoverable, [])
  assert.deepEqual(errors, [])
  console.log('Browser hydration passed', {
    react: requireReact('react').version,
    browser: browser.version(),
    ...result
  })
  const diagnostics = await page.evaluate(() => window.hydrationProbe.debug)
  const mutations = diagnostics.filter((event) => event.type === 'mutation')
  const notifications = diagnostics.filter((event) => event.type === 'notify')
  assert.ok(diagnostics.some((event) => event.type === 'dependencies' && event.label === 'Delayed'))
  assert.ok(
    notifications.some(
      (event) =>
        event.storeId === 'browser-derived' &&
        event.mutation.storeId === 'browser-hydration' &&
        event.via.some((edge) => edge.getters.includes('fromOther'))
    )
  )
  for (const event of notifications) {
    assert.ok(
      mutations.some(
        (source) => source.mutation.id === event.mutation.id && source.mutation.storeId === event.mutation.storeId
      ),
      'Notifications must retain a real source Mutation'
    )
  }
  assert.equal(JSON.stringify(diagnostics).includes('"prevState"'), false)
  console.log('Browser diagnostics passed', { mutations: mutations.length, notifications: notifications.length })
  await page.evaluate(() => window.hydrationProbe.stopDebug())
  await page.locator('#update').click()
  await page.waitForFunction(() => document.querySelector('#delayed')?.textContent === '7|new|14|14:new|14:new')
  assert.equal(await page.evaluate(() => window.hydrationProbe.debug.length), diagnostics.length)
  await page.evaluate(() => window.hydrationProbe.unmount())
  assert.deepEqual(await page.evaluate(() => window.hydrationProbe.checkLifecycle()), {
    cycles: 3,
    installed: 3,
    stopped: 3
  })
  assert.deepEqual(errors, [])
  console.log(
    'Browser lifecycle passed: supplied Context, nested real Actions, reset, pending rejection and 3 disposal cycles'
  )

  const next = process.env.PINIA_NEXT_URL
  if (next) {
    const url = new URL(next)
    assert.equal(url.hostname, '127.0.0.1', 'Only a local synthetic Next server is allowed')
    // Only the missing favicon is mocked; application and RSC responses stay untouched.
    await page.route(new URL('/favicon.ico', url).href, (route) => route.fulfill({ status: 204 }))
    await page.goto(new URL('/sharing', url).href)
    await page.waitForFunction(() => document.querySelector('[data-testid="shared-value"]')?.textContent === '10')
    await page.getByRole('button', { name: 'Component A: +1' }).click()
    assert.deepEqual(await page.getByTestId('shared-value').allTextContents(), ['11', '11'])
    const revision = await page.getByTestId('server-revision').textContent()
    assert.ok(revision?.trim(), 'The initial server revision must be present')
    assert.ok(await page.getByTestId('server-revision').isVisible(), 'The server revision must be visible')
    await page.getByRole('button', { name: 'Refresh server data' }).click()
    await page.waitForFunction((previous) => {
      const current = document.querySelector('[data-testid="server-revision"]')?.textContent
      return Boolean(current && current !== previous)
    }, revision)
    assert.deepEqual(await page.getByTestId('shared-value').allTextContents(), ['11', '11'])
    await page.getByRole('button', { name: 'Component B: +1' }).click()
    assert.deepEqual(await page.getByTestId('shared-value').allTextContents(), ['12', '12'])
    await page.getByRole('link', { name: 'Open another page' }).click()
    await page.waitForURL('**/details')
    assert.deepEqual(await page.getByTestId('shared-value').allTextContents(), ['12', '12'])
    assert.deepEqual(errors, [])
    console.log(
      'Production Next browser passed: initial 10, update 11, server revision changes on router.refresh and preserves 11, navigation preserves 12'
    )
  }
  await context.close()
} finally {
  await browser?.close()
  if (server) await new Promise((done) => server.close(done))
  const target = realpathSync(temporary)
  assert.equal(dirname(target), temporaryRoot)
  assert.ok(basename(target).startsWith('pinia-hydration-') && !relative(temporaryRoot, target).startsWith('..'))
  rmSync(target, { recursive: true, force: true })
}
