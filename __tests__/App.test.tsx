// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import React from 'react'

function App() {
  const [s, set] = React.useState()
  return (
    <div className='App'>
      <header className='App-header'>
        <div>
          <h1>It works and you found me!</h1>
        </div>
      </header>
    </div>
  )
}

describe('App', () => {
  it('renders headline', () => {
    render(<App />)
    const headline = screen.getByText(/It works and you found me!/i)
    // @ts-ignore
    expect(headline).toBeInTheDocument()
  })
})
