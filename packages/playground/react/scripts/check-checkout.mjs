import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const spa = new URL(process.env.PINIA_REACT_URL || 'http://127.0.0.1:4173')
const next = new URL(process.env.PINIA_NEXT_URL || 'http://127.0.0.1:4174')
for (const url of [spa, next]) assert.equal(url.hostname, '127.0.0.1', 'Local synthetic servers only')
const key = 'pinia:checkout-shipping'
const requestCases = [
  ['pickup', JSON.stringify({ shipping: 'pickup' }), '12.00'],
  ['delivery', JSON.stringify({ shipping: 'delivery' }), '17.00'],
  ['malformed', 'broken-json', '12.00'],
  ['unsafe', '{"__proto__":{"polluted":true}}', '12.00'],
  ['pick-only', JSON.stringify({ shipping: 'delivery', address: 'DO_NOT_RESTORE', stock: 100 }), '17.00'],
  ['missing', null, '12.00']
]
const ssr = await Promise.all(
  requestCases.map(async ([name, value, total]) => {
    const response = await fetch(new URL('/checkout', next), {
      headers: {
        Cookie:
          'unrelated-secret=DO_NOT_SERIALIZE' +
          (value === null ? '' : '; ' + encodeURIComponent(key) + '=' + encodeURIComponent(value))
      }
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.has('set-cookie'), false)
    const html = await response.text()
    assert.ok(html.includes('>' + total + '</strong>'), name + ' must derive its total in first HTML')
    assert.ok(html.includes('data-testid="checkout-stock">3</strong>'))
    assert.ok(!html.includes('DO_NOT_SERIALIZE'), 'Unrelated cookies must not cross to client props')
    // The allowlisted raw cookie crosses RSC props; pick controls restored fields, not transport redaction.
    assert.match(html, /id="[^"]+-address"[^>]*value=""/, 'Address must not restore into the business form')
    if (total === '17.00') assert.ok(html.includes('Address required'))
    return { name, total, status: response.status }
  })
)
const browser = await chromium.launch({ headless: true, channel: process.env.PINIA_BROWSER_CHANNEL || undefined })
const observations = []
try {
  const context = await browser.newContext()
  try {
    await context.addInitScript(() => {
      window.checkoutDevtools = []
      window.__REDUX_DEVTOOLS_EXTENSION__ = {
        connect: ({ name }) => {
          const probe = { name, actions: [], state: null, listener: null }
          window.checkoutDevtools.push(probe)
          return {
            init: (state) => {
              probe.state = state
            },
            send: (action, state) => {
              probe.actions.push(action.type)
              probe.state = state
            },
            subscribe: (listener) => {
              probe.listener = listener
              return () => {}
            },
            unsubscribe: () => {}
          }
        }
      }
    })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    for (const url of [spa, next])
      await page.route(new URL('/favicon.ico', url).href, (route) => route.fulfill({ status: 204 }))
    async function flow(label) {
      const panel = page.getByRole('region', { name: label, exact: true })
      await panel.getByLabel('Quantity', { exact: true }).fill('4')
      await panel.getByRole('status').filter({ hasText: 'Not enough stock' }).waitFor()
      assert.equal(await panel.getByRole('button', { name: 'Place order', exact: true }).isEnabled(), false)
      await panel.getByLabel('Quantity', { exact: true }).fill('2')
      await panel.getByLabel('Shipping', { exact: true }).selectOption('delivery')
      await panel.getByRole('status').filter({ hasText: 'Address required' }).waitFor()
      await panel.getByLabel('Address (not saved)', { exact: true }).fill('Synthetic address')
      await panel.getByRole('button', { name: 'Simulate failed order', exact: true }).click()
      await panel.getByRole('status').filter({ hasText: 'Synthetic network failure; retry' }).waitFor()
      await panel.getByRole('button', { name: 'Place order', exact: true }).click()
      await panel.getByText('2 notebook(s), delivery, $29.00', { exact: true }).waitFor()
      assert.equal(await panel.getByTestId('checkout-stock').textContent(), '1')
      assert.ok((await panel.getByTestId('checkout-shared').textContent()).includes('2 notebook(s)'))
      observations.push(label + ': linked validation, failure/retry, stock=1, shared cart=2')
    }
    await page.goto(new URL('/#checkout', spa).href)
    await flow('Pinia-React checkout')
    await flow('Zustand checkout')
    const protocol = await page.evaluate(() => {
      const probe = window.checkoutDevtools.find((entry) => entry.name.endsWith('Checkout cart'))
      const before = probe.actions.length
      probe.listener({ type: 'DISPATCH', payload: { type: 'JUMP_TO_STATE' }, state: JSON.stringify({ quantity: 1 }) })
      return {
        names: window.checkoutDevtools.map((entry) => entry.name),
        actions: window.checkoutDevtools.flatMap((entry) => entry.actions),
        noEcho: probe.actions.length === before
      }
    })
    assert.equal(protocol.noEcho, true)
    for (const action of ['setQuantity', 'setShipping', 'setAddress', 'place', 'reserve'])
      assert.ok(protocol.actions.includes(action), action)
    assert.equal(protocol.names.filter((name) => name.includes('Checkout')).length, 4)
    await page
      .getByRole('region', { name: 'Pinia-React checkout', exact: true })
      .getByTestId('checkout-shared')
      .filter({ hasText: '1 notebook(s)' })
      .waitFor()
    assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key), { shipping: 'delivery' })
    await page.reload()
    await page
      .getByRole('region', { name: 'Pinia-React checkout', exact: true })
      .getByRole('status')
      .filter({ hasText: 'Address required' })
      .waitFor()
    await context.addCookies([
      {
        name: encodeURIComponent(key),
        value: encodeURIComponent(JSON.stringify({ shipping: 'delivery' })),
        url: next.origin
      }
    ])
    const response = await page.goto(new URL('/checkout', next).href)
    assert.equal(response.status(), 200)
    const panel = page.getByRole('region', { name: 'Pinia-React checkout', exact: true })
    await panel.getByLabel('Shipping', { exact: true }).selectOption('pickup')
    await flow('Pinia-React checkout')
    const revision = await page.getByTestId('server-revision').textContent()
    assert.ok(revision?.trim(), 'The initial server revision must be present')
    await page.getByRole('button', { name: 'Refresh checkout server data', exact: true }).click()
    await page.waitForFunction((previous) => {
      const current = document.querySelector('[data-testid="server-revision"]')?.textContent
      return Boolean(current && current !== previous)
    }, revision)
    assert.equal(await panel.getByTestId('checkout-stock').textContent(), '1')
    assert.equal(await panel.getByLabel('Quantity', { exact: true }).inputValue(), '2')
    const cookie = (await context.cookies(next.href)).find((cookie) => cookie.name === encodeURIComponent(key))
    assert.deepEqual(JSON.parse(decodeURIComponent(cookie.value)), { shipping: 'delivery' })
    await page.reload()
    await panel.getByRole('status').filter({ hasText: 'Address required' }).waitFor()
    assert.equal(await panel.getByTestId('checkout-stock').textContent(), '3')
    assert.equal(await panel.getByLabel('Quantity', { exact: true }).inputValue(), '1')
    assert.equal(await panel.getByLabel('Shipping', { exact: true }).inputValue(), 'delivery')
    assert.equal(await panel.getByLabel('Address (not saved)', { exact: true }).inputValue(), '')
    assert.deepEqual(errors, [])
    const result = {
      measuredAt: new Date().toISOString(),
      node: process.version,
      playwright: require('playwright/package.json').version,
      browser: browser.version(),
      channel: process.env.PINIA_BROWSER_CHANNEL,
      ssr,
      observations,
      protocol,
      refresh: 'HTTP 200 text/x-component; client stock=1 quantity=2 retained',
      reload: 'request cookie delivery retained; address/order/stock not persisted',
      consoleErrors: errors
    }
    mkdirSync(root + '/dist/measurements', { recursive: true })
    writeFileSync(root + '/dist/measurements/checkout-browser.json', JSON.stringify(result, null, 2) + '\n')
    console.log('Checkout production browser and 6-request business SSR passed', result)
  } finally {
    await context.close()
  }
} finally {
  await browser.close()
}
