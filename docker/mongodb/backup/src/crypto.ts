import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'

const MAGIC = Buffer.from('PDBK')
const VERSION = 1
const NONCE_LENGTH = 12
const TAG_LENGTH = 16

export function loadKey(encoded: string): Buffer {
  if (!encoded) {
    throw new Error('MONGODB_BACKUP_ENCRYPTION_KEY is not configured')
  }

  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) {
    throw new Error(
      'MONGODB_BACKUP_ENCRYPTION_KEY must contain 32 bytes encoded as base64',
    )
  }

  return key
}

export function encryptBuffer(plaintext: Buffer, key: Buffer): Buffer {
  const nonce = randomBytes(NONCE_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([MAGIC, Buffer.from([VERSION]), nonce, tag, ciphertext])
}

export function decryptBuffer(payload: Buffer, key: Buffer): Buffer {
  if (payload.length < MAGIC.length + 1 + NONCE_LENGTH + TAG_LENGTH) {
    throw new Error('backup file is too short')
  }

  if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('invalid backup file magic')
  }

  if (payload[MAGIC.length] !== VERSION) {
    throw new Error(
      `unsupported backup format version ${payload[MAGIC.length]}`,
    )
  }

  const nonce = payload.subarray(
    MAGIC.length + 1,
    MAGIC.length + 1 + NONCE_LENGTH,
  )
  const tag = payload.subarray(
    MAGIC.length + 1 + NONCE_LENGTH,
    MAGIC.length + 1 + NONCE_LENGTH + TAG_LENGTH,
  )
  const ciphertext = payload.subarray(
    MAGIC.length + 1 + NONCE_LENGTH + TAG_LENGTH,
  )

  const decipher = createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}
