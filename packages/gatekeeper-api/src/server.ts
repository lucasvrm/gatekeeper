import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import router from './api/routes/index.js'
import { errorHandler } from './api/middlewares/errorHandler.js'
import { requestLogger } from './api/middlewares/requestLogger.js'

const app = express()

app.use(helmet())
app.use(cors())
app.use(compression())
app.use(express.json())
app.use(requestLogger)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)

app.use(errorHandler)

export default app
