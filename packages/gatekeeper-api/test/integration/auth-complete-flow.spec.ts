/**
 * @file auth-complete-flow.spec.ts
 * @description Contract spec — Sistema completo de autenticação JWT com configuração via DB
 * @contract auth-system-jwt-complete
 * @mode STRICT
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { AuthService } from '@/services/AuthService'
import jwt from 'jsonwebtoken'

// ── Configuração ───────────────────────────────────────────────────────────

const prisma = new PrismaClient()
const authService = new AuthService(prisma)

// ── Helpers ─────────────────────────────────────────────────────────────────

async function cleanupTestUsers() {
  await prisma.user.deleteMany({
    where: {
      email: {
        contains: '@test-auth-flow.com'
      }
    }
  })
}

async function cleanupValidationConfig() {
  await prisma.validationConfig.deleteMany({
    where: {
      key: {
        startsWith: 'TEST_JWT_'
      }
    }
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanupTestUsers()
  await cleanupValidationConfig()
})

afterAll(async () => {
  await cleanupTestUsers()
  await cleanupValidationConfig()
  await prisma.$disconnect()
})

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Auth System - Registration', () => {
  // @clause CL-AUTH-001
  it('succeeds when user registers with valid email and password', async () => {
    const result = await authService.register(
      'newuser@test-auth-flow.com',
      'password123'
    )

    expect(result).toBeDefined()
    expect(result.token).toBeDefined()
    expect(result.user).toBeDefined()
    expect(result.user.email).toBe('newuser@test-auth-flow.com')
    expect(result.user.id).toBeDefined()

    // Verificar que token é JWT válido
    const tokenParts = result.token.split('.')
    expect(tokenParts).toHaveLength(3)

    // Verificar que usuário foi criado no DB
    const dbUser = await prisma.user.findFirst({
      where: { email: 'newuser@test-auth-flow.com' }
    })
    expect(dbUser).toBeDefined()
    expect(dbUser!.passwordHash).toBeDefined()
    expect(dbUser!.passwordHash).not.toBe('password123')
  })

  // @clause CL-AUTH-001
  it('succeeds when user password is hashed with bcrypt', async () => {
    const result = await authService.register(
      'hashed@test-auth-flow.com',
      'securepass'
    )

    const dbUser = await prisma.user.findFirst({
      where: { email: 'hashed@test-auth-flow.com' }
    })

    expect(dbUser!.passwordHash).toMatch(/^\$2[aby]\$10\$/)
  })

  // @clause CL-AUTH-002
  it('fails when user registers with duplicate email', async () => {
    await authService.register('duplicate@test-auth-flow.com', 'password123')

    await expect(
      authService.register('duplicate@test-auth-flow.com', 'otherpass')
    ).rejects.toMatchObject({
      statusCode: 409,
      error: 'EMAIL_ALREADY_EXISTS'
    })
  })
})

describe('Auth System - Login', () => {
  // @clause CL-AUTH-003
  it('succeeds when user logs in with valid credentials', async () => {
    // Setup: criar usuário
    await authService.register('login@test-auth-flow.com', 'password123')

    // Act: fazer login
    const result = await authService.login('login@test-auth-flow.com', 'password123')

    // Assert
    expect(result).toBeDefined()
    expect(result.token).toBeDefined()
    expect(result.user.email).toBe('login@test-auth-flow.com')
    expect(result.user.id).toBeDefined()

    // Verificar que token é JWT válido
    const tokenParts = result.token.split('.')
    expect(tokenParts).toHaveLength(3)
  })

  // @clause CL-AUTH-003
  it('succeeds when login returns token with userId in payload', async () => {
    await authService.register('payload@test-auth-flow.com', 'password123')
    const result = await authService.login('payload@test-auth-flow.com', 'password123')

    const decoded = authService.verifyToken(result.token)
    expect(decoded).toBeDefined()
    expect(decoded!.userId).toBe(result.user.id)
  })

  // @clause CL-AUTH-004
  it('fails when user logs in with invalid password', async () => {
    await authService.register('wrongpass@test-auth-flow.com', 'correctpass')

    await expect(
      authService.login('wrongpass@test-auth-flow.com', 'wrongpass')
    ).rejects.toMatchObject({
      statusCode: 401,
      error: 'INVALID_CREDENTIALS'
    })
  })

  // @clause CL-AUTH-004
  it('fails when user logs in with non-existent email', async () => {
    await expect(
      authService.login('nonexistent@test-auth-flow.com', 'password123')
    ).rejects.toMatchObject({
      statusCode: 401,
      error: 'INVALID_CREDENTIALS'
    })
  })
})

describe('Auth System - Token Validation', () => {
  // @clause CL-AUTH-005
  it('succeeds when valid token is verified and decoded', async () => {
    const result = await authService.register('tokentest@test-auth-flow.com', 'password123')

    const decoded = authService.verifyToken(result.token)

    expect(decoded).toBeDefined()
    expect(decoded!.userId).toBe(result.user.id)
    expect(decoded!.iat).toBeDefined()
    expect(decoded!.exp).toBeDefined()
  })

  // @clause CL-AUTH-005
  it('succeeds when token status is valid for fresh token', async () => {
    const result = await authService.register('status@test-auth-flow.com', 'password123')

    const status = authService.checkTokenStatus(result.token)

    expect(status).toBe('valid')
  })

  // @clause CL-AUTH-006
  it('fails when token is malformed', async () => {
    const status = authService.checkTokenStatus('malformed.token.xyz')

    expect(status).toBe('invalid')
  })

  // @clause CL-AUTH-006
  it('fails when token is invalid and verifyToken returns null', async () => {
    const decoded = authService.verifyToken('invalid-token-123')

    expect(decoded).toBeNull()
  })

  // @clause CL-AUTH-007
  it('fails when token is expired', async () => {
    // Criar token que expira em 1 segundo
    const userId = 'test-user-id'
    const secret = process.env.JWT_SECRET || 'test-secret-key'
    const expiredToken = jwt.sign({ userId }, secret, { expiresIn: '1s' })

    // Aguardar expiração
    await delay(1100)

    const status = authService.checkTokenStatus(expiredToken)

    expect(status).toBe('expired')
  })

  // @clause CL-AUTH-007
  it('fails when expired token returns null on verification', async () => {
    const userId = 'test-user-expired'
    const secret = process.env.JWT_SECRET || 'test-secret-key'
    const expiredToken = jwt.sign({ userId }, secret, { expiresIn: '1s' })

    await delay(1100)

    const decoded = authService.verifyToken(expiredToken)

    expect(decoded).toBeNull()
  })
})

describe('Auth System - Default JWT Expiry', () => {
  // @clause CL-AUTH-010
  it('succeeds when token uses default expiry of 3600 seconds', async () => {
    // Limpar qualquer config existente
    await prisma.validationConfig.deleteMany({
      where: { key: 'JWT_EXPIRY_SECONDS' }
    })

    const result = await authService.register('defaultexp@test-auth-flow.com', 'password123')
    const decoded = authService.verifyToken(result.token) as jwt.JwtPayload

    expect(decoded).toBeDefined()
    const expirySeconds = decoded.exp! - decoded.iat!
    expect(expirySeconds).toBe(3600)
  })

  // @clause CL-AUTH-010
  it('succeeds when generateTokenAsync uses default expiry without config', async () => {
    await prisma.validationConfig.deleteMany({
      where: { key: 'JWT_EXPIRY_SECONDS' }
    })

    const token = await authService.generateTokenAsync('test-user-default')
    const decoded = authService.verifyToken(token) as jwt.JwtPayload

    const expirySeconds = decoded.exp! - decoded.iat!
    expect(expirySeconds).toBe(3600)
  })
})

describe('Auth System - Configurable JWT Expiry', () => {
  // @clause CL-AUTH-011
  it('succeeds when JWT_EXPIRY_SECONDS config exists and is used', async () => {
    // Criar config com 600 segundos (10 minutos)
    await prisma.validationConfig.create({
      data: {
        key: 'JWT_EXPIRY_SECONDS',
        value: '600',
        type: 'NUMBER',
        category: 'auth',
        description: 'Test JWT expiry'
      }
    })

    const token = await authService.generateTokenAsync('test-user-config')
    const decoded = authService.verifyToken(token) as jwt.JwtPayload

    expect(decoded).toBeDefined()
    const expirySeconds = decoded.exp! - decoded.iat!
    expect(expirySeconds).toBe(600)
  })

  // @clause CL-AUTH-011
  it('succeeds when getJwtExpirySeconds returns configured value', async () => {
    await prisma.validationConfig.create({
      data: {
        key: 'JWT_EXPIRY_SECONDS',
        value: '1800',
        type: 'NUMBER',
        category: 'auth'
      }
    })

    const expiry = await authService.getJwtExpirySeconds()

    expect(expiry).toBe(1800)
  })

  // @clause CL-AUTH-011
  it('fails when JWT_EXPIRY_SECONDS config has invalid value and falls back to default', async () => {
    await prisma.validationConfig.create({
      data: {
        key: 'JWT_EXPIRY_SECONDS',
        value: 'invalid',
        type: 'NUMBER',
        category: 'auth'
      }
    })

    const expiry = await authService.getJwtExpirySeconds()

    expect(expiry).toBe(3600) // Default fallback
  })
})

describe('Auth System - Password Security', () => {
  // @clause CL-AUTH-015
  it('succeeds when password is hashed with bcrypt SALT_ROUNDS=10', async () => {
    const result = await authService.register('salt@test-auth-flow.com', 'password123')

    const dbUser = await prisma.user.findFirst({
      where: { email: 'salt@test-auth-flow.com' }
    })

    // Formato bcrypt: $2b$10$...
    expect(dbUser!.passwordHash).toMatch(/^\$2[aby]\$10\$/)
  })

  // @clause CL-AUTH-015
  it('succeeds when password verification works with bcrypt hash', async () => {
    await authService.register('verify@test-auth-flow.com', 'mypassword')

    const dbUser = await prisma.user.findFirst({
      where: { email: 'verify@test-auth-flow.com' }
    })

    const isValid = await authService.verifyPassword('mypassword', dbUser!.passwordHash)
    const isInvalid = await authService.verifyPassword('wrongpassword', dbUser!.passwordHash)

    expect(isValid).toBe(true)
    expect(isInvalid).toBe(false)
  })

  // @clause CL-AUTH-015
  it('fails when plaintext password is stored (never happens)', async () => {
    const plainPassword = 'supersecret123'
    await authService.register('security@test-auth-flow.com', plainPassword)

    const dbUser = await prisma.user.findFirst({
      where: { email: 'security@test-auth-flow.com' }
    })

    expect(dbUser!.passwordHash).not.toBe(plainPassword)
  })
})

describe('Auth System - Email Case Insensitivity', () => {
  // @clause CL-AUTH-016
  it('succeeds when email is normalized to lowercase on registration', async () => {
    const result = await authService.register('CaseSensitive@test-auth-flow.com', 'password123')

    const dbUser = await prisma.user.findFirst({
      where: { email: { equals: 'casesensitive@test-auth-flow.com', mode: 'insensitive' } }
    })

    expect(dbUser).toBeDefined()
  })

  // @clause CL-AUTH-016
  it('succeeds when login works with different email casing', async () => {
    await authService.register('lowercase@test-auth-flow.com', 'password123')

    // Login com email em uppercase
    const result = await authService.login('LOWERCASE@test-auth-flow.com', 'password123')

    expect(result).toBeDefined()
    expect(result.user).toBeDefined()
  })

  // @clause CL-AUTH-016
  it('fails when duplicate email detection is case-insensitive', async () => {
    await authService.register('duplicate@test-auth-flow.com', 'password123')

    await expect(
      authService.register('DUPLICATE@test-auth-flow.com', 'password456')
    ).rejects.toMatchObject({
      statusCode: 409,
      error: 'EMAIL_ALREADY_EXISTS'
    })
  })
})

describe('Auth System - User Retrieval', () => {
  // @clause CL-AUTH-010
  it('succeeds when getMe returns user info for valid userId', async () => {
    const result = await authService.register('getme@test-auth-flow.com', 'password123')

    const user = await authService.getMe(result.user.id)

    expect(user).toBeDefined()
    expect(user.email).toBe('getme@test-auth-flow.com')
    expect(user.id).toBe(result.user.id)
  })

  // @clause CL-AUTH-010
  it('fails when getMe throws USER_NOT_FOUND for invalid userId', async () => {
    await expect(
      authService.getMe('non-existent-user-id')
    ).rejects.toMatchObject({
      statusCode: 404,
      error: 'USER_NOT_FOUND'
    })
  })
})
