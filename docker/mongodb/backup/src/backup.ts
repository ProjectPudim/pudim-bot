import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encryptBuffer, loadKey, sha256 } from './crypto'
import type { BackupEnv } from './env'

export interface BackupResult {
  filename: string
  path: string
  size: number
  sha256: string
  createdAt: string
}

function timestampForFilename(date: Date): string {
  return date.toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
}

function acquireLock(lockPath: string): void {
  try {
    const fd = openSync(lockPath, 'wx')
    writeFileSync(fd, String(process.pid))
    closeSync(fd)
  } catch {
    throw new Error('another backup process is already running')
  }
}

function releaseLock(lockPath: string): void {
  try {
    unlinkSync(lockPath)
  } catch {
    // Ignore missing lock files.
  }
}

async function runMongodump(uri: string, archivePath: string): Promise<void> {
  const processHandle = Bun.spawn(
    ['mongodump', `--uri=${uri}`, `--archive=${archivePath}`, '--gzip'],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )

  const exitCode = await processHandle.exited
  const stderr = await new Response(processHandle.stderr).text()

  if (exitCode !== 0) {
    throw new Error(`mongodump exited with code ${exitCode}: ${stderr.trim()}`)
  }

  const file = Bun.file(archivePath)
  if (!(await file.exists()) || file.size === 0) {
    throw new Error('mongodump produced an empty or missing archive')
  }
}

export function applyRetention(dir: string, retentionDays: number): void {
  const cutoff = Date.now() - retentionDays * 86_400_000

  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.enc')) {
      continue
    }

    const fullPath = join(dir, entry)
    try {
      const stats = statSync(fullPath)
      if (stats.mtimeMs < cutoff) {
        unlinkSync(fullPath)
      }
    } catch {
      // Ignore files that disappear between listing and deletion.
    }
  }
}

export async function createBackup(env: BackupEnv): Promise<BackupResult> {
  if (!env.enabled) {
    throw new Error('backups are disabled')
  }

  if (!env.mongodbUri) {
    throw new Error('MONGODB_URI is not configured')
  }

  const key = loadKey(env.encryptionKey)
  mkdirSync(env.dir, { recursive: true })

  const lockPath = join(env.dir, '.backup.lock')
  acquireLock(lockPath)

  try {
    const startedAt = new Date()
    const stamp = timestampForFilename(startedAt)
    const filename = `${env.name}-mongodb-${stamp}.archive.gz.enc`
    const tempArchive = join(
      tmpdir(),
      `${env.name}-mongodb-${stamp}.archive.gz`,
    )
    const finalPath = join(env.dir, filename)
    const tempFinal = `${finalPath}.tmp`

    await runMongodump(env.mongodbUri, tempArchive)

    const plaintext = Buffer.from(await Bun.file(tempArchive).arrayBuffer())
    const encrypted = encryptBuffer(plaintext, key)

    await Bun.write(tempFinal, encrypted)
    renameSync(tempFinal, finalPath)

    try {
      rmSync(tempArchive, { force: true })
    } catch {
      // Ignore temporary file cleanup errors.
    }

    applyRetention(env.dir, env.retentionDays)

    return {
      filename,
      path: finalPath,
      size: encrypted.length,
      sha256: sha256(encrypted),
      createdAt: startedAt.toISOString(),
    }
  } finally {
    releaseLock(lockPath)
  }
}
