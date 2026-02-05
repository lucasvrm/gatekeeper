import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../db/client.js'

const SALT_ROUNDS = 10
const DEFAULT_JWT_EXPIRY_SECONDS = 3600 // 1 hour

export interface JwtPayload {
  userId: string
  iat?: number
  exp?: number
}

export class AuthService {
  private jwtSecret: string

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'test-secret-key'
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
   * Generate a JWT token for a user
   */
  generateToken(userId: string): string {
    const expirySeconds = this.getJwtExpirySecondsSync()
    return jwt.sign(
      { userId },
      this.jwtSecret,
      { expiresIn: expirySeconds }
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
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
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
      const config = await prisma.validationConfig.findUnique({
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
   * Get JWT expiry seconds synchronously (uses default if not cached)
   * Used internally for token generation
   */
  private getJwtExpirySecondsSync(): number {
    return DEFAULT_JWT_EXPIRY_SECONDS
  }
}
