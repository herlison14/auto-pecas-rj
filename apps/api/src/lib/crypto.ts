import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const PREFIX = 'enc:'

function key(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) throw new Error('ENCRYPTION_KEY not set')
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
  return buf
}

/** Encrypts a plaintext string. No-op (returns plaintext) when ENCRYPTION_KEY is not set. */
export function encrypt(plaintext: string): string {
  if (!process.env.ENCRYPTION_KEY) return plaintext
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`
}

/** Decrypts an encrypted string. Returns plaintext as-is if not encrypted (backward-compatible). */
export function decrypt(value: string): string {
  if (!value.startsWith(PREFIX)) return value
  if (!process.env.ENCRYPTION_KEY) return value
  const [ivHex, tagHex, ctHex] = value.slice(PREFIX.length).split(':')
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8')
}
