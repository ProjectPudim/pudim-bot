export interface BackupEnv {
  mongodbUri: string
  enabled: boolean
  interval: string
  retentionDays: number
  dir: string
  name: string
  maxUploadBytes: number
  webhookUrl: string
  encryptionKey: string
  database: string
}

export function loadEnv(): BackupEnv {
  return {
    mongodbUri: process.env.MONGODB_URI ?? '',
    enabled:
      (process.env.MONGODB_BACKUP_ENABLED ?? 'true').toLowerCase() === 'true',
    interval: process.env.MONGODB_BACKUP_INTERVAL ?? '1h',
    retentionDays: Number(process.env.MONGODB_BACKUP_RETENTION_DAYS ?? '7'),
    dir: process.env.MONGODB_BACKUP_DIR ?? '/data/backups',
    name: process.env.MONGODB_BACKUP_NAME ?? 'pudim',
    maxUploadBytes: Number(
      process.env.MONGODB_BACKUP_MAX_UPLOAD_BYTES ?? '26214400',
    ),
    webhookUrl: process.env.MONGODB_BACKUP_WEBHOOK_URL ?? '',
    encryptionKey: process.env.MONGODB_BACKUP_ENCRYPTION_KEY ?? '',
    database: process.env.MONGODB_BACKUP_DATABASE ?? '',
  }
}

export function parseInterval(value: string): number {
  const match = value.trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i)
  if (!match) {
    throw new Error(`invalid backup interval: ${value}`)
  }

  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`invalid backup interval: ${value}`)
  }

  const unit = (match[2] ?? 's').toLowerCase()
  let milliseconds: number

  switch (unit) {
    case 'ms':
      milliseconds = amount
      break
    case 's':
      milliseconds = amount * 1_000
      break
    case 'm':
      milliseconds = amount * 60_000
      break
    case 'h':
      milliseconds = amount * 3_600_000
      break
    case 'd':
      milliseconds = amount * 86_400_000
      break
    default:
      throw new Error(`invalid backup interval unit: ${value}`)
  }

  if (milliseconds < 60_000) {
    throw new Error(`backup interval must be at least 60 seconds: ${value}`)
  }

  return milliseconds
}
