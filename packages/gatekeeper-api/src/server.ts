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
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(requestLogger)
app.use(authMiddleware)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)

app.use(errorHandler)

export default app
