'use client'

import type { ReactNode } from 'react'

export type ExampleId = 'counter' | 'sharing' | 'persistence'

export function Playground({
  framework,
  navigation,
  children
}: {
  framework: 'React' | 'Next.js'
  navigation: ReactNode
  children: ReactNode
}) {
  return (
    <div className='playground'>
      <header className='site-header'>
        <a className='brand' href={framework === 'React' ? '#counter' : '/'} aria-label='pinia-react home'>
          <span className='brand-mark' aria-hidden='true'>
            p.
          </span>
          pinia<span className='brand-suffix'>-react</span>
        </a>
        <span className='framework-badge'>
          <span className='status-dot' />
          {framework} playground
        </span>
        <a
          className='docs-link'
          href='https://github.com/savageKarl/pinia-react#readme'
          target='_blank'
          rel='noreferrer'
        >
          Read the docs <span aria-hidden='true'>↗</span>
        </a>
      </header>
      <main>
        <div className='intro'>
          <p className='eyebrow'>SMALL EXAMPLES. SHARED STATE.</p>
          <h1>
            Shared state. <span>Made simple.</span>
          </h1>
          <p className='intro-description'>
            Three small examples, from a single update to{' '}
            {framework === 'React' ? 'preferences that survive a refresh' : 'state shared between server and browser'}.
          </p>
        </div>
        <nav className='example-nav' aria-label='Examples'>
          {navigation}
        </nav>
        {children}
        <div className='learning-note'>
          <span aria-hidden='true'>↳</span> Try the demo, then read the code. One idea at a time.
        </div>
      </main>
      <footer className='site-footer'>
        <span>pinia-react</span>
        <span>Less boilerplate. More focus.</span>
        <span>Built with {framework}</span>
      </footer>
    </div>
  )
}

export function Example({
  number,
  title,
  description,
  file,
  code,
  children
}: {
  number: string
  title: string
  description: string
  file: string
  code: string
  children: ReactNode
}) {
  return (
    <section className='example' aria-label={title}>
      <div className='example-heading'>
        <span className='example-number'>EXAMPLE {number}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className='workbench'>
        <div className='demo-surface'>
          <div className='surface-heading'>
            <span className='status-dot' />
            Interactive demo<span>LIVE</span>
          </div>
          {children}
        </div>
        <aside className='code-panel' aria-label='Example code'>
          <div className='code-heading'>
            <span>{file}</span>
            <span className='code-language'>TS / TSX</span>
          </div>
          <pre>
            <code>{code}</code>
          </pre>
          <div className='code-footer'>
            <span aria-hidden='true'>⌁</span> The essential code, right here.
          </div>
        </aside>
      </div>
    </section>
  )
}

export function StatePreview({ state }: { state: unknown }) {
  return (
    <details className='state-preview'>
      <summary>Inspect current state</summary>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </details>
  )
}
