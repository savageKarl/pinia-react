// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import Sharing from '../app/sharing/page'

vi.mock('../app/App', () => ({
  App: ({ example }: { example: string }) => <div data-example={example} />
}))

it('renders a fresh visible server revision alongside the sharing App on each server render', () => {
  const revisions = [renderToStaticMarkup(<Sharing />), renderToStaticMarkup(<Sharing />)].map((html) => {
    expect(html).toContain('data-example="sharing"')
    const revision = html.match(/data-testid="server-revision">([^<]+)<\/output>/)?.[1]
    expect(revision).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    return revision
  })
  expect(revisions[0]).not.toBe(revisions[1])
})
