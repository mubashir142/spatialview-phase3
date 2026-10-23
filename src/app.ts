import cors from 'cors'
import express from 'express'
import type { Pool } from 'pg'
import { createFacilitiesRouter } from './routes/facilities.js'

export function createApp(pool: Pool) {
  const app = express()

  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
  app.get('/health', async (_request, response) => {
    try {
      await pool.query('SELECT 1')
      response.json({ status: 'ok', database: 'connected' })
    } catch (error) {
      console.error('Health check database query failed:', error)
      response.status(503).json({ status: 'error', database: 'unavailable' })
    }
  })
  app.use('/api/facilities', createFacilitiesRouter(pool))
  app.use((
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('Unhandled API error:', error)
    response.status(500).json({ error: 'Internal server error.' })
  })

  return app
}
