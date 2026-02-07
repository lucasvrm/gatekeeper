import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import router from './api/routes/index.js'
import { errorHandler } from './api/middlewares/errorHandler.js'
import { requestLogger } from './api/middlewares/requestLogger.js'
import { authMiddleware } from './api/middlewares/authMiddleware.js'

const app = express()

app.use(helmet())
app.use(cors())

// Compression: skip SSE routes (text/event-stream)
app.use(compression({
  filter: (req, res) => {
    // Disable compression for SSE endpoints
    if (req.path.includes('/events/') && req.method === 'GET') {
      return false
    }
    // Default: compress if response has no Content-Type or if compression.filter returns true
    return compression.filter(req, res)
  }
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(requestLogger)
app.use(authMiddleware)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)

app.use(errorHandler)

export { app }
export default app
