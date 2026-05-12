import fetch from 'node-fetch'
import { io } from 'socket.io-client'
import jwt from 'jsonwebtoken'

const SERVER = process.env.SERVER_URL || 'http://localhost:4000'
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

async function main() {
  console.log('Running smoke tests against', SERVER)
  // health check
  const h = await fetch(`${SERVER}/health`).catch((e) => {
    console.error('Health check failed', e)
    process.exit(2)
  })
  const json = await h.json()
  if (!json || !json.ok) {
    console.error('Health check unexpected response', json)
    process.exit(3)
  }
  console.log('Health OK')

  // create a test token and connect via socket
  const token = jwt.sign({ userId: 1, cafeId: 1 }, JWT_SECRET, { expiresIn: '1h' })
  const socket = io(SERVER, { auth: { token }, transports: ['websocket'] })

  const timeout = setTimeout(() => {
    console.error('Socket connection timed out')
    socket.close()
    process.exit(4)
  }, 5000)

  socket.on('connect', () => {
    clearTimeout(timeout)
    console.log('Socket connected, id=', socket.id)
    socket.close()
    process.exit(0)
  })

  socket.on('connect_error', (err: any) => {
    clearTimeout(timeout)
    console.error('Socket connect_error', err)
    socket.close()
    process.exit(5)
  })
}

main()
