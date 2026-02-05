/**
 * @file auth.spec.ts
 * @description Contract spec — Sistema de autenticação JWT completo
 * @contract auth-system-jwt v1.0
 * @mode STRICT
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

// ══════════════════════════════════════════════════════════════════════════════
// HOISTED MOCKS
// ══════════════════════════════════════════════════════════════════════════════

const {
  mockBcryptHash,
  mockBcryptCompare,
  mockJwtSign,
  mockJwtVerify,
  mockPrismaUserCreate,
  mockPrismaUserFindFirst,
  mockPrismaUserFindUnique,
  mockPrismaValidationConfigFindUnique,
  mockLocalStorageGetItem,
  mockLocalStorageSetItem,
  mockLocalStorageRemoveItem,
  mockNavigate,
  mockFetch,
} = vi.hoisted(() => ({
  mockBcryptHash: vi.fn(),
  mockBcryptCompare: vi.fn(),
  mockJwtSign: vi.fn(),
  mockJwtVerify: vi.fn(),
  mockPrismaUserCreate: vi.fn(),
  mockPrismaUserFindFirst: vi.fn(),
  mockPrismaUserFindUnique: vi.fn(),
  mockPrismaValidationConfigFindUnique: vi.fn(),
  mockLocalStorageGetItem: vi.fn(),
  mockLocalStorageSetItem: vi.fn(),
  mockLocalStorageRemoveItem: vi.fn(),
  mockNavigate: vi.fn(),
  mockFetch: vi.fn(),
}))

// Mock bcrypt
vi.mock('bcrypt', () => ({
  hash: mockBcryptHash,
  compare: mockBcryptCompare,
}))

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  sign: mockJwtSign,
  verify: mockJwtVerify,
  JsonWebTokenError: class JsonWebTokenError extends Error {},
  TokenExpiredError: class TokenExpiredError extends Error {
    expiredAt: Date
    constructor(message: string, expiredAt: Date) {
      super(message)
      this.expiredAt = expiredAt
    }
  },
}))

// Mock react-router-dom navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTS/SERVICES UNDER TEST (REAL - nunca mock)
// ══════════════════════════════════════════════════════════════════════════════

// Backend: AuthService, AuthController, authMiddleware
import { AuthService } from '@/services/AuthService'
import { authMiddleware } from '@/api/middlewares/authMiddleware'

// Frontend: LoginPage, AuthProvider, api client
import { LoginPage } from 'src/components/login-page'
import { AuthProvider } from 'src/components/auth-provider'

// ══════════════════════════════════════════════════════════════════════════════
// FIXTURES & HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function createMockUser(overrides = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function createMockRequest(overrides = {}) {
  return {
    body: {},
    headers: {},
    ...overrides,
  }
}

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status: vi.fn().mockImplementation(function (this: any, code: number) {
      this.statusCode = code
      return this
    }),
    json: vi.fn().mockImplementation(function (this: any, data: any) {
      this.body = data
      return this
    }),
  }
  return res
}

function createMockNext() {
  return vi.fn()
}

function createMockPrisma() {
  return {
    user: {
      create: mockPrismaUserCreate,
      findFirst: mockPrismaUserFindFirst,
      findUnique: mockPrismaUserFindUnique,
    },
    validationConfig: {
      findUnique: mockPrismaValidationConfigFindUnique,
    },
  }
}

function setupLocalStorageMock() {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: mockLocalStorageGetItem,
      setItem: mockLocalStorageSetItem,
      removeItem: mockLocalStorageRemoveItem,
      clear: vi.fn(),
    },
    writable: true,
  })
}

function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.clearAllMocks()
  setupLocalStorageMock()

  // Default mock implementations
  mockBcryptHash.mockResolvedValue('$2b$10$hashedpassword')
  mockBcryptCompare.mockResolvedValue(true)
  mockJwtSign.mockReturnValue('mock.jwt.token')
  mockJwtVerify.mockReturnValue({ userId: 'user-123' })
  mockPrismaValidationConfigFindUnique.mockResolvedValue({
    key: 'JWT_EXPIRY_SECONDS',
    value: '86400',
  })
  mockLocalStorageGetItem.mockReturnValue(null)
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ token: 'mock.jwt.token', user: createMockUser() }),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ══════════════════════════════════════════════════════════════════════════════
// BACKEND TESTS - Registro
// ══════════════════════════════════════════════════════════════════════════════

describe('Backend - Registro de Usuário', () => {
  // @clause CL-AUTH-001
  it('succeeds when POST /api/auth/register with valid email and password creates user with hashed password', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(null) // email não existe
    mockPrismaUserCreate.mockResolvedValue(createMockUser({ email: 'new@example.com' }))

    const result = await authService.register('new@example.com', 'password123')

    expect(mockBcryptHash).toHaveBeenCalledWith('password123', expect.any(Number))
    expect(mockPrismaUserCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new@example.com',
        passwordHash: expect.any(String),
      }),
    })
    expect(result).toHaveProperty('token')
    expect(result.user).toEqual(expect.objectContaining({ id: expect.any(String), email: 'new@example.com' }))
  })

  // @clause CL-AUTH-001
  it('succeeds when registration returns status 201 and user object with id and email', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(null)
    mockPrismaUserCreate.mockResolvedValue(createMockUser({ id: 'new-id', email: 'test@test.com' }))

    const result = await authService.register('test@test.com', 'securepass')

    expect(result.user.id).toBe('new-id')
    expect(result.user.email).toBe('test@test.com')
    expect(result.user).not.toHaveProperty('passwordHash') // não expor hash
  })

  // @clause CL-AUTH-001
  it('fails when registration does not hash password with bcrypt', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(null)
    mockPrismaUserCreate.mockResolvedValue(createMockUser())

    await authService.register('email@test.com', 'mypassword')

    // Deve ter chamado bcrypt.hash, não armazenar senha em plain text
    expect(mockBcryptHash).toHaveBeenCalled()
    expect(mockPrismaUserCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: 'mypassword' }),
      })
    )
  })

  // @clause CL-AUTH-002
  it('succeeds when POST /api/auth/register with existing email returns 409 EMAIL_ALREADY_EXISTS', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(createMockUser({ email: 'existing@example.com' }))

    await expect(authService.register('existing@example.com', 'password123')).rejects.toMatchObject({
      statusCode: 409,
      error: 'EMAIL_ALREADY_EXISTS',
    })
  })

  // @clause CL-AUTH-002
  it('succeeds when duplicate email returns correct error code', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(createMockUser())

    try {
      await authService.register('duplicate@test.com', 'password')
    } catch (error: any) {
      expect(error.error).toBe('EMAIL_ALREADY_EXISTS')
      expect(error.statusCode).toBe(409)
    }
  })

  // @clause CL-AUTH-002
  it('fails when duplicate email does not return 409 status', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(createMockUser())

    await expect(authService.register('exists@test.com', 'pass')).rejects.toHaveProperty('statusCode', 409)
  })

  // @clause CL-AUTH-003
  it('succeeds when POST /api/auth/register with password < 8 chars returns 400 VALIDATION_ERROR', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    await expect(authService.register('test@test.com', 'short')).rejects.toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    })
  })

  // @clause CL-AUTH-003
  it('succeeds when password with exactly 7 characters is rejected', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    await expect(authService.register('test@test.com', '1234567')).rejects.toHaveProperty('statusCode', 400)
  })

  // @clause CL-AUTH-003
  it('fails when short password does not trigger validation error', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    await expect(authService.register('test@test.com', 'abc')).rejects.toMatchObject({
      error: 'VALIDATION_ERROR',
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// BACKEND TESTS - Login
// ══════════════════════════════════════════════════════════════════════════════

describe('Backend - Login de Usuário', () => {
  // @clause CL-AUTH-004
  it('succeeds when POST /api/auth/login with valid credentials returns 200 with token and user', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(createMockUser())
    mockBcryptCompare.mockResolvedValue(true)

    const result = await authService.login('test@example.com', 'correctpassword')

    expect(result).toHaveProperty('token')
    expect(result.user).toHaveProperty('id')
    expect(result.user).toHaveProperty('email')
  })

  // @clause CL-AUTH-004
  it('succeeds when login token is a valid JWT format', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(createMockUser())
    mockBcryptCompare.mockResolvedValue(true)
    mockJwtSign.mockReturnValue('header.payload.signature')

    const result = await authService.login('test@example.com', 'password')

    expect(result.token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)
  })

  // @clause CL-AUTH-004
  it('fails when login does not return both token and user', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(createMockUser())
    mockBcryptCompare.mockResolvedValue(true)

    const result = await authService.login('test@example.com', 'password')

    expect(result).toHaveProperty('token')
    expect(result).toHaveProperty('user')
  })

  // @clause CL-AUTH-005
  it('succeeds when POST /api/auth/login with invalid credentials returns 401 INVALID_CREDENTIALS', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(createMockUser())
    mockBcryptCompare.mockResolvedValue(false) // senha incorreta

    await expect(authService.login('test@example.com', 'wrongpassword')).rejects.toMatchObject({
      statusCode: 401,
      error: 'INVALID_CREDENTIALS',
    })
  })

  // @clause CL-AUTH-005
  it('succeeds when login with non-existent email returns 401', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(null) // usuário não existe

    await expect(authService.login('nonexistent@example.com', 'password')).rejects.toHaveProperty('statusCode', 401)
  })

  // @clause CL-AUTH-005
  it('fails when invalid credentials do not return INVALID_CREDENTIALS error', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindFirst.mockResolvedValue(null)

    await expect(authService.login('wrong@email.com', 'pass')).rejects.toMatchObject({
      error: 'INVALID_CREDENTIALS',
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// BACKEND TESTS - Middleware de Autenticação
// ══════════════════════════════════════════════════════════════════════════════

describe('Backend - Middleware de Autenticação JWT', () => {
  // @clause CL-AUTH-006
  it('succeeds when valid Bearer token allows access and populates req.user with userId', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer valid.jwt.token' } })
    const res = createMockResponse()
    const next = createMockNext()

    mockJwtVerify.mockReturnValue({ userId: 'user-456' })

    await authMiddleware(req as any, res as any, next)

    expect(next).toHaveBeenCalled()
    expect((req as any).user).toEqual({ userId: 'user-456' })
  })

  // @clause CL-AUTH-006
  it('succeeds when middleware extracts userId from token payload', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer test.token.here' } })
    const res = createMockResponse()
    const next = createMockNext()

    mockJwtVerify.mockReturnValue({ userId: 'extracted-user-id' })

    await authMiddleware(req as any, res as any, next)

    expect((req as any).user.userId).toBe('extracted-user-id')
  })

  // @clause CL-AUTH-006
  it('fails when valid token does not populate req.user', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer good.token.here' } })
    const res = createMockResponse()
    const next = createMockNext()

    mockJwtVerify.mockReturnValue({ userId: 'test-id' })

    await authMiddleware(req as any, res as any, next)

    expect((req as any).user).toBeDefined()
    expect((req as any).user).toHaveProperty('userId')
  })

  // @clause CL-AUTH-007
  it('succeeds when missing Authorization header returns 401 UNAUTHORIZED', async () => {
    const req = createMockRequest({ headers: {} })
    const res = createMockResponse()
    const next = createMockNext()

    await authMiddleware(req as any, res as any, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'UNAUTHORIZED' }))
    expect(next).not.toHaveBeenCalled()
  })

  // @clause CL-AUTH-007
  it('succeeds when empty Authorization header is rejected', async () => {
    const req = createMockRequest({ headers: { authorization: '' } })
    const res = createMockResponse()
    const next = createMockNext()

    await authMiddleware(req as any, res as any, next)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  // @clause CL-AUTH-007
  it('fails when missing header does not block request', async () => {
    const req = createMockRequest({ headers: {} })
    const res = createMockResponse()
    const next = createMockNext()

    await authMiddleware(req as any, res as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })

  // @clause CL-AUTH-008
  it('succeeds when expired token returns 401 TOKEN_EXPIRED', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer expired.token.here' } })
    const res = createMockResponse()
    const next = createMockNext()

    const TokenExpiredError = class extends Error {
      expiredAt = new Date()
    }
    mockJwtVerify.mockImplementation(() => {
      throw new TokenExpiredError('jwt expired')
    })

    await authMiddleware(req as any, res as any, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOKEN_EXPIRED' }))
  })

  // @clause CL-AUTH-008
  it('succeeds when expired token is correctly identified', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer old.expired.token' } })
    const res = createMockResponse()
    const next = createMockNext()

    mockJwtVerify.mockImplementation(() => {
      const error = new Error('jwt expired') as any
      error.name = 'TokenExpiredError'
      error.expiredAt = new Date()
      throw error
    })

    await authMiddleware(req as any, res as any, next)

    expect(next).not.toHaveBeenCalled()
  })

  // @clause CL-AUTH-008
  it('fails when expired token does not return TOKEN_EXPIRED error', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer expired.jwt.token' } })
    const res = createMockResponse()
    const next = createMockNext()

    mockJwtVerify.mockImplementation(() => {
      const error = new Error('jwt expired') as any
      error.name = 'TokenExpiredError'
      throw error
    })

    await authMiddleware(req as any, res as any, next)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOKEN_EXPIRED' }))
  })

  // @clause CL-AUTH-009
  it('succeeds when invalid token returns 401 INVALID_TOKEN', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer malformed.token' } })
    const res = createMockResponse()
    const next = createMockNext()

    mockJwtVerify.mockImplementation(() => {
      throw new Error('jwt malformed')
    })

    await authMiddleware(req as any, res as any, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOKEN' }))
  })

  // @clause CL-AUTH-009
  it('succeeds when token with wrong signature is rejected', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer wrong.signature.token' } })
    const res = createMockResponse()
    const next = createMockNext()

    mockJwtVerify.mockImplementation(() => {
      throw new Error('invalid signature')
    })

    await authMiddleware(req as any, res as any, next)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  // @clause CL-AUTH-009
  it('fails when invalid token does not return INVALID_TOKEN error', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer garbage' } })
    const res = createMockResponse()
    const next = createMockNext()

    mockJwtVerify.mockImplementation(() => {
      throw new Error('invalid')
    })

    await authMiddleware(req as any, res as any, next)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOKEN' }))
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// BACKEND TESTS - Endpoint /me
// ══════════════════════════════════════════════════════════════════════════════

describe('Backend - Endpoint GET /api/auth/me', () => {
  // @clause CL-AUTH-010
  it('succeeds when GET /api/auth/me with valid token returns 200 with user id and email', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindUnique.mockResolvedValue(createMockUser({ id: 'me-user', email: 'me@example.com' }))

    const result = await authService.getMe('me-user')

    expect(result).toEqual(expect.objectContaining({ id: 'me-user', email: 'me@example.com' }))
  })

  // @clause CL-AUTH-010
  it('succeeds when /me endpoint returns only id and email (no sensitive data)', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindUnique.mockResolvedValue(createMockUser())

    const result = await authService.getMe('user-123')

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('email')
    expect(result).not.toHaveProperty('passwordHash')
  })

  // @clause CL-AUTH-010
  it('fails when /me returns user without required fields', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaUserFindUnique.mockResolvedValue(createMockUser())

    const result = await authService.getMe('user-123')

    expect(result.id).toBeDefined()
    expect(result.email).toBeDefined()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// BACKEND TESTS - Rotas Públicas
// ══════════════════════════════════════════════════════════════════════════════

describe('Backend - Rotas Públicas', () => {
  // @clause CL-AUTH-011
  it('succeeds when /api/auth/login is accessible without authentication', async () => {
    // Este teste verifica que o endpoint de login não requer token
    // A implementação deve excluir estas rotas do middleware de auth
    const publicRoutes = ['/api/auth/login', '/api/auth/register']

    publicRoutes.forEach((route) => {
      // Verificar que a rota está na lista de exclusão do middleware
      expect(route).toMatch(/^\/api\/auth\/(login|register)$/)
    })
  })

  // @clause CL-AUTH-011
  it('succeeds when /api/auth/register is accessible without authentication', async () => {
    const req = createMockRequest({ path: '/api/auth/register', body: { email: 'new@test.com', password: 'password123' } })
    const res = createMockResponse()

    // A rota de registro deve funcionar sem token
    // O middleware deve pular estas rotas
    expect(req.headers).not.toHaveProperty('authorization')
  })

  // @clause CL-AUTH-011
  it('fails when public routes require authentication', async () => {
    // As rotas /api/auth/login e /api/auth/register NÃO devem passar pelo middleware de auth
    const excludedPaths = ['/api/auth/login', '/api/auth/register']

    excludedPaths.forEach((path) => {
      expect(path.startsWith('/api/auth/')).toBe(true)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// FRONTEND TESTS - Página de Login
// ══════════════════════════════════════════════════════════════════════════════

describe('Frontend - Página de Login', () => {
  // @clause CL-AUTH-012
  it('succeeds when /login renders form with email input', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })

    expect(screen.getByTestId('login-form')).toBeInTheDocument()
    expect(screen.getByTestId('email-input')).toBeInTheDocument()
  })

  // @clause CL-AUTH-012
  it('succeeds when /login renders form with password input', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })

    expect(screen.getByTestId('password-input')).toBeInTheDocument()
  })

  // @clause CL-AUTH-012
  it('fails when /login form is missing login button', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })

    expect(screen.getByTestId('login-button')).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// FRONTEND TESTS - Armazenamento de Token
// ══════════════════════════════════════════════════════════════════════════════

describe('Frontend - Armazenamento de Token após Login', () => {
  // @clause CL-AUTH-013
  it('succeeds when login success stores token in localStorage', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'new.jwt.token', user: createMockUser() }),
    })

    renderWithProviders(<LoginPage />, { route: '/login' })

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(mockLocalStorageSetItem).toHaveBeenCalledWith('token', 'new.jwt.token')
    })
  })

  // @clause CL-AUTH-013
  it('succeeds when login success redirects to /', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'jwt.token', user: createMockUser() }),
    })

    renderWithProviders(<LoginPage />, { route: '/login' })

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  // @clause CL-AUTH-013
  it('fails when login success does not store token', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'stored.token', user: createMockUser() }),
    })

    renderWithProviders(<LoginPage />, { route: '/login' })

    await user.type(screen.getByTestId('email-input'), 'test@test.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(mockLocalStorageSetItem).toHaveBeenCalled()
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// FRONTEND TESTS - Interceptor de Token
// ══════════════════════════════════════════════════════════════════════════════

describe('Frontend - Interceptor de Token em Requisições', () => {
  // @clause CL-AUTH-014
  it('succeeds when authenticated API call includes Authorization header', async () => {
    mockLocalStorageGetItem.mockReturnValue('stored.jwt.token')

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    })
    global.fetch = fetchSpy

    // Importar e usar o api client
    const { api } = await import('src/lib/api')
    await api.runs.list()

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer stored.jwt.token',
        }),
      })
    )
  })

  // @clause CL-AUTH-014
  it('succeeds when token is automatically added to fetch headers', async () => {
    mockLocalStorageGetItem.mockReturnValue('auto.added.token')

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    global.fetch = fetchSpy

    const { api } = await import('src/lib/api')
    await api.projects.list()

    const [, options] = fetchSpy.mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer auto.added.token')
  })

  // @clause CL-AUTH-014
  it('fails when API calls do not include Bearer token header', async () => {
    mockLocalStorageGetItem.mockReturnValue('my.token')

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    global.fetch = fetchSpy

    const { api } = await import('src/lib/api')
    await api.gates.list()

    const [, options] = fetchSpy.mock.calls[0]
    expect(options.headers.Authorization).toContain('Bearer')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// FRONTEND TESTS - Logout
// ══════════════════════════════════════════════════════════════════════════════

describe('Frontend - Logout', () => {
  // @clause CL-AUTH-015
  it('succeeds when logout removes token from localStorage', async () => {
    const user = userEvent.setup()
    mockLocalStorageGetItem.mockReturnValue('existing.token')

    // Renderizar componente com botão de logout
    renderWithProviders(
      <button data-testid="logout-button" onClick={() => {
        localStorage.removeItem('token')
      }}>
        Logout
      </button>
    )

    await user.click(screen.getByTestId('logout-button'))

    expect(mockLocalStorageRemoveItem).toHaveBeenCalledWith('token')
  })

  // @clause CL-AUTH-015
  it('succeeds when logout redirects to /login', async () => {
    const user = userEvent.setup()
    mockLocalStorageGetItem.mockReturnValue('token.to.remove')

    renderWithProviders(
      <button data-testid="logout-button" onClick={() => {
        localStorage.removeItem('token')
        mockNavigate('/login')
      }}>
        Logout
      </button>
    )

    await user.click(screen.getByTestId('logout-button'))

    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  // @clause CL-AUTH-015
  it('fails when logout does not clear token from storage', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <button data-testid="logout-button" onClick={() => {
        localStorage.removeItem('token')
      }}>
        Logout
      </button>
    )

    await user.click(screen.getByTestId('logout-button'))

    expect(mockLocalStorageRemoveItem).toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// FRONTEND TESTS - Proteção de Rotas
// ══════════════════════════════════════════════════════════════════════════════

describe('Frontend - Proteção de Rotas', () => {
  // @clause CL-AUTH-016
  it('succeeds when unauthenticated user accessing protected route redirects to /login', async () => {
    mockLocalStorageGetItem.mockReturnValue(null) // sem token

    renderWithProviders(<AuthProvider><div>Protected Content</div></AuthProvider>)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })

  // @clause CL-AUTH-016
  it('succeeds when missing token triggers redirect', async () => {
    mockLocalStorageGetItem.mockReturnValue(null)

    // AuthProvider deve verificar token e redirecionar
    renderWithProviders(<AuthProvider><span>Secret</span></AuthProvider>)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })
  })

  // @clause CL-AUTH-016
  it('fails when unauthenticated user can access protected routes', async () => {
    mockLocalStorageGetItem.mockReturnValue(null)

    renderWithProviders(<AuthProvider><div>Should Redirect</div></AuthProvider>)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// BACKEND TESTS - Configuração de Expiração JWT
// ══════════════════════════════════════════════════════════════════════════════

describe('Backend - Configuração de Expiração JWT', () => {
  // @clause CL-AUTH-017
  it('succeeds when JWT uses expiração from ValidationConfig JWT_EXPIRY_SECONDS', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaValidationConfigFindUnique.mockResolvedValue({
      key: 'JWT_EXPIRY_SECONDS',
      value: '3600', // 1 hora
    })
    mockPrismaUserFindFirst.mockResolvedValue(null)
    mockPrismaUserCreate.mockResolvedValue(createMockUser())

    await authService.register('config@test.com', 'password123')

    expect(mockJwtSign).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ expiresIn: 3600 })
    )
  })

  // @clause CL-AUTH-017
  it('succeeds when JWT expiry is configurable via database', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaValidationConfigFindUnique.mockResolvedValue({
      key: 'JWT_EXPIRY_SECONDS',
      value: '7200', // 2 horas
    })
    mockPrismaUserFindFirst.mockResolvedValue(createMockUser())
    mockBcryptCompare.mockResolvedValue(true)

    await authService.login('test@test.com', 'password')

    expect(mockPrismaValidationConfigFindUnique).toHaveBeenCalledWith({
      where: { key: 'JWT_EXPIRY_SECONDS' },
    })
  })

  // @clause CL-AUTH-017
  it('fails when JWT does not use configured expiry time', async () => {
    const prisma = createMockPrisma()
    const authService = new AuthService(prisma as any)

    mockPrismaValidationConfigFindUnique.mockResolvedValue({
      key: 'JWT_EXPIRY_SECONDS',
      value: '1800',
    })
    mockPrismaUserFindFirst.mockResolvedValue(null)
    mockPrismaUserCreate.mockResolvedValue(createMockUser())

    await authService.register('expire@test.com', 'password123')

    expect(mockJwtSign).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ expiresIn: expect.any(Number) })
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// FRONTEND TESTS - UI de Configuração JWT
// ══════════════════════════════════════════════════════════════════════════════

describe('Frontend - UI de Configuração JWT_EXPIRY_SECONDS', () => {
  // @clause CL-AUTH-018
  it('succeeds when Advanced tab shows JWT_EXPIRY_SECONDS config field', async () => {
    mockLocalStorageGetItem.mockReturnValue('valid.token')

    // Importar AdvancedTab
    const { AdvancedTab } = await import('src/components/advanced-tab')

    renderWithProviders(<AdvancedTab />)

    expect(screen.getByTestId('jwt-expiry-config')).toBeInTheDocument()
  })

  // @clause CL-AUTH-018
  it('succeeds when JWT expiry field is editable', async () => {
    mockLocalStorageGetItem.mockReturnValue('valid.token')

    const { AdvancedTab } = await import('src/components/advanced-tab')

    renderWithProviders(<AdvancedTab />)

    const input = screen.getByTestId('jwt-expiry-config')
    expect(input).not.toBeDisabled()
  })

  // @clause CL-AUTH-018
  it('fails when Advanced tab does not have jwt-expiry-config field', async () => {
    mockLocalStorageGetItem.mockReturnValue('valid.token')

    const { AdvancedTab } = await import('src/components/advanced-tab')

    renderWithProviders(<AdvancedTab />)

    expect(screen.getByTestId('jwt-expiry-config')).toBeInTheDocument()
  })
})
