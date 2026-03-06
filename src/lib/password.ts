import { createHash, randomBytes, pbkdf2Sync } from 'crypto'

const SALT_LENGTH = 16
const ITERATIONS = 10000
const KEY_LENGTH = 64
const DIGEST = 'sha512'

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex')
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  
  const verifyHash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex')
  return hash === verifyHash
}
