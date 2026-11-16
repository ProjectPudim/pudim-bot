import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const MAGIC = Buffer.from('PDBK')
const VERSION_LEGACY = 1
const VERSION_STREAMING = 2
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

  return Buffer.concat([
    MAGIC,
    Buffer.from([VERSION_LEGACY]),
    nonce,
    tag,
    ciphertext,
  ])
}

export function decryptBuffer(payload: Buffer, key: Buffer): Buffer {
  if (payload.length < MAGIC.length + 1 + NONCE_LENGTH + TAG_LENGTH) {
    throw new Error('backup file is too short')
  }

  if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('invalid backup file magic')
  }

  const version = payload[MAGIC.length]

  if (version === VERSION_LEGACY) {
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

  if (version === VERSION_STREAMING) {
    if (payload.length < MAGIC.length + 1 + NONCE_LENGTH + TAG_LENGTH) {
      throw new Error('backup file is too short')
    }

    const nonce = payload.subarray(
      MAGIC.length + 1,
      MAGIC.length + 1 + NONCE_LENGTH,
    )
    const tag = payload.subarray(payload.length - TAG_LENGTH)
    const ciphertext = payload.subarray(
      MAGIC.length + 1 + NONCE_LENGTH,
      payload.length - TAG_LENGTH,
    )

    const decipher = createDecipheriv('aes-256-gcm', key, nonce)
    decipher.setAuthTag(tag)

    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  throw new Error(`unsupported backup format version ${version}`)
}

export async function encryptFile(
  inputPath: string,
  outputPath: string,
  key: Buffer,
): Promise<void> {
  const nonce = randomBytes(NONCE_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const header = Buffer.concat([MAGIC, Buffer.from([VERSION_STREAMING]), nonce])

  const transform = new Transform({
    transform(chunk, _encoding, callback) {
      try {
        callback(null, cipher.update(chunk))
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)))
      }
    },
    flush(callback) {
      try {
        callback(null, cipher.final())
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)))
      }
    },
  })

  const { appendFileSync } = await import('node:fs')
  const { writeFileSync } = await import('node:fs')

  writeFileSync(outputPath, header)
  await pipeline(
    createReadStream(inputPath),
    transform,
    createWriteStream(outputPath, { flags: 'a' }),
  )

  appendFileSync(outputPath, cipher.getAuthTag())
}

export async function decryptFile(
  inputPath: string,
  outputPath: string,
  key: Buffer,
): Promise<void> {
  const { readFileSync, writeFileSync } = await import('node:fs')
  const payload = readFileSync(inputPath)
  const decrypted = decryptBuffer(payload, key)
  writeFileSync(outputPath, decrypted)
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function sha256File(path: string): Promise<string> {
  const { createReadStream } = await import('node:fs')
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}
