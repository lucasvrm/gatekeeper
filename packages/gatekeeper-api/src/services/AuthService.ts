import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const SALT_ROUNDS = 10
const DEFAULT_JWT_EXPIRY_SECONDS = 3600 // 1 hour

export interface JwtPayload {
  userId: string
  iat?: number
  exp?: number
}

export interface AuthError {
  statusCode: number
  error: string
  message: string
}

export interface AuthUser {
  id: string
  email: string
}

export interface AuthResult {
  token: string
  user: AuthUser
}

export interface RegisterResult {
  token: string
  user: AuthUser
}

export class AuthService {
  private jwtSecret: string
  private prisma: any

  constructor(prisma?: any) {
    this.jwtSecret = process.env.JWT_SECRET || 'test-secret-key'
    this.prisma = prisma
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS)
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  /**
   * Generate a JWT token for a user (async - uses configured expiry)
   */
  async generateTokenAsync(userId: string): Promise<string> {
    const expirySeconds = await this.getJwtExpirySeconds()
    return jwt.sign(
      { userId },
      this.jwtSecret,
      { expiresIn: expirySeconds }
    )
  }

  /**
   * Generate a JWT token for a user (sync - uses default expiry)
   */
  generateToken(userId: string): string {
    return jwt.sign(
      { userId },
      this.jwtSecret,
      { expiresIn: DEFAULT_JWT_EXPIRY_SECONDS }
    )
  }

  /**
   * Verify and decode a JWT token
   * Returns the decoded payload or null if invalid
   */
  verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload
      return decoded
    } catch {
      return null
    }
  }

  /**
   * Check if a token is expired
   * Returns 'expired' if expired, 'invalid' if malformed, 'valid' if ok
   */
  checkTokenStatus(token: string): 'valid' | 'expired' | 'invalid' {
    try {
      jwt.verify(token, this.jwtSecret)
      return 'valid'
    } catch (error: any) {
      if (error?.name === 'TokenExpiredError' || error?.expiredAt) {
        return 'expired'
      }
      return 'invalid'
    }
  }

  /**
   * Get JWT expiry seconds from ValidationConfig (async version)
   */
  async getJwtExpirySeconds(): Promise<number> {
    try {
      if (!this.prisma) return DEFAULT_JWT_EXPIRY_SECONDS
      const config = await this.prisma.validationConfig.findUnique({
        where: { key: 'JWT_EXPIRY_SECONDS' }
      })
      if (config?.value) {
        const parsed = parseInt(config.value, 10)
        if (!isNaN(parsed) && parsed > 0) {
          return parsed
        }
      }
    } catch {
      // Fall through to default
    }
    return DEFAULT_JWT_EXPIRY_SECONDS
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string): Promise<RegisterResult> {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase()

    // Validate password length
    if (password.length < 8) {
      const error: AuthError = {
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'Password must be at least 8 characters'
      }
      throw error
    }

    // Check if email already exists (case-insensitive via normalization)
    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail }
    })

    if (existingUser) {
      const error: AuthError = {
        statusCode: 409,
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'Email already registered'
      }
      throw error
    }

    // Hash password
    const passwordHash = await this.hashPassword(password)

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash
      }
    })

    // Generate token with configured expiry
    const token = await this.generateTokenAsync(user.id)

    return {
      token,
      user: {
        id: user.id,
        email: user.email
      }
    }
  }

  /**
   * Login a user
   */
  async login(email: string, password: string): Promise<AuthResult> {
    // Find user by email
    const user = await this.prisma.user.findFirst({
      where: { email }
    })

    if (!user) {
      const error: AuthError = {
        statusCode: 401,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      }
      throw error
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.passwordHash)

    if (!isValid) {
      const error: AuthError = {
        statusCode: 401,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      }
      throw error
    }

    // Generate token with configured expiry
    const token = await this.generateTokenAsync(user.id)

    return {
      token,
      user: {
        id: user.id,
        email: user.email
      }
    }
  }

  /**
   * Get current user info
   */
  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      const error: AuthError = {
        statusCode: 404,
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      }
      throw error
    }

    return {
      id: user.id,
      email: user.email
    }
  }
}
