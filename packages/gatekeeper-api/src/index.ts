import 'dotenv/config'
import app from './server.js'
import { config } from './config/index.js'
import { prisma } from './db/client.js'

async function main() {
  try {
    await prisma.$connect()
    console.log('✓ Database connected')

    const server = app.listen(config.port, () => {
      console.log(`✓ Server running on port ${config.port}`)
      console.log(`✓ Environment: ${config.nodeEnv}`)
      console.log(`✓ Health check: http://localhost:${config.port}/health`)
      console.log(`✓ API base: http://localhost:${config.port}/api`)
    })

    const shutdown = async () => {
      console.log('\nShutting down gracefully...')
      
      server.close(() => {
        console.log('✓ HTTP server closed')
      })

      await prisma.$disconnect()
      console.log('✓ Database disconnected')
      
      process.exit(0)
    }

    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
  } catch (error) {
    console.error('Failed to start server:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
