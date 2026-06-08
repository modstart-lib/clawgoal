import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'

/**
 * Create a JWT token
 * Add user permission validation logic here in the future
 */
export function createToken(userId: number, tenantId: number): string {
  return jwt.sign(
    { userId: Number(userId), tenantId: Number(tenantId) },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions
  )
}

/**
 * Refresh JWT token (re-issue based on authenticated userId and tenantId)
 * Add user permission validation logic here in the future
 */
export function refreshToken(userId: number, tenantId: number): string {
  return createToken(userId, tenantId)
}

/**
 * Verify JWT token, returns the decoded payload
 */
export function verifyToken(token: string): {
  userId: number
  tenantId: number
} {
  const decoded = jwt.verify(token, config.jwt.secret) as {
    userId: number
    tenantId: number
  }
  return { userId: Number(decoded.userId), tenantId: Number(decoded.tenantId) }
}

/**
 * Check whether the given userId/tenantId belongs to the supervisor account.
 */
export function isSupervisor(userId: number, tenantId: number): boolean {
  return (
    userId === config.supervisorUserId && tenantId === config.supervisorTenantId
  )
}
