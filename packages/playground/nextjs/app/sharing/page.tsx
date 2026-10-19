import { randomUUID } from 'node:crypto'
import { App } from '../App'

export default function Sharing() {
  const revision = randomUUID()
  return (
    <>
      <App example='sharing' />
      <p className='demo-hint'>
        Server revision: <output data-testid='server-revision'>{revision}</output>
      </p>
    </>
  )
}
