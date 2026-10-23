import 'dotenv/config'
import { createApp } from './app.js'
import { pool } from './db/pool.js'

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.')
}

const server = createApp(pool).listen(port, () => {
  console.log(`SpatialView API listening on port ${port}`)
})

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error('Failed to stop the API server cleanly:', error)
      process.exitCode = 1
    }
    void pool.end()
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
