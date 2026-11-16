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
    return 3_600_000
  }

  const amount = Number(match[1])
  const unit = (match[2] ?? 's').toLowerCase()

  switch (unit) {
    case 'ms':
      return amount
    case 's':
      return amount * 1_000
    case 'm':
      return amount * 60_000
    case 'h':
      return amount * 3_600_000
    case 'd':
      return amount * 86_400_000
    default:
      return amount * 1_000
  }
}
