import { render, screen } from '@testing-library/react'

function App() {
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
    expect(headline).toBeInTheDocument()
  })
})
