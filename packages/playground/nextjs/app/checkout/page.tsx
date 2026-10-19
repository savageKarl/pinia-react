import { randomUUID } from 'node:crypto'
import { App } from '../App'

export default function Checkout() {
  const revision = randomUUID()
  return (
    <>
      <App example='checkout' />
      <p className='demo-hint'>
        Server revision: <output data-testid='server-revision'>{revision}</output>
      </p>
    </>
  )
}
