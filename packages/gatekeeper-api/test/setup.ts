import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

import { beforeAll, beforeEach, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PACKAGE_ROOT = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(PACKAGE_ROOT, '.env.test') })

const prisma = new PrismaClient()
let migrated = false

const migrate = () => {
  if (migrated) return
  execSync('npx prisma migrate deploy', {
    cwd: PACKAGE_ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  })
  migrated = true
}

const clearDatabase = async () => {
  await prisma.elicitationMessage.deleteMany()
  await prisma.elicitationSession.deleteMany()
  await prisma.lLMAgent.deleteMany()

  await prisma.manifestFile.deleteMany()
  await prisma.validatorResult.deleteMany()
  await prisma.gateResult.deleteMany()
  await prisma.validationLog.deleteMany()
  await prisma.validationRun.deleteMany()

  await prisma.sensitiveFileRule.deleteMany()
  await prisma.ambiguousTerm.deleteMany()
  await prisma.validationConfig.deleteMany()
}

beforeAll(() => migrate(), 120000)

beforeEach(async () => {
  await clearDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})
