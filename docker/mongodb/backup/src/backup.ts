import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encryptFile, loadKey, sha256File } from './crypto'
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

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function acquireLock(lockPath: string): void {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(lockPath, 'wx')
      writeFileSync(fd, String(process.pid))
      closeSync(fd)
      return
    } catch {
      try {
        const pid = Number(readFileSync(lockPath, 'utf8').trim())
        if (Number.isFinite(pid) && !isProcessAlive(pid)) {
          unlinkSync(lockPath)
          continue
        }
      } catch {
        // Ignore unreadable locks and treat them as active.
      }

      throw new Error('another backup process is already running')
    }
  }

  throw new Error('another backup process is already running')
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

export function applyRetention(
  dir: string,
  retentionDays: number,
  pending: string[] = [],
): void {
  const cutoff = Date.now() - retentionDays * 86_400_000
  const pendingSet = new Set(pending)

  const candidates = readdirSync(dir)
    .filter((entry) => entry.endsWith('.enc'))
    .map((entry) => {
      try {
        return { entry, mtime: statSync(join(dir, entry)).mtimeMs }
      } catch {
        return null
      }
    })
    .filter((item): item is { entry: string; mtime: number } => item !== null)
    .sort((a, b) => b.mtime - a.mtime)

  // Keep at least the newest valid backup.
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]

    if (pendingSet.has(candidate.entry)) {
      continue
    }

    if (index === 0) {
      continue
    }

    if (candidate.mtime < cutoff) {
      try {
        unlinkSync(join(dir, candidate.entry))
      } catch {
        // Ignore files that disappear between listing and deletion.
      }
    }
  }
}

function readPendingNames(dir: string): string[] {
  try {
    const parsed = JSON.parse(
      readFileSync(join(dir, '.pending-uploads.json'), 'utf8'),
    )
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'string')
      : []
  } catch {
    return []
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

    try {
      await runMongodump(env.mongodbUri, tempArchive)
      await encryptFile(tempArchive, tempFinal, key)
      renameSync(tempFinal, finalPath)

      const size = (await import('node:fs')).statSync(finalPath).size
      const hash = await sha256File(finalPath)

      applyRetention(env.dir, env.retentionDays, readPendingNames(env.dir))

      return {
        filename,
        path: finalPath,
        size,
        sha256: hash,
        createdAt: startedAt.toISOString(),
      }
    } finally {
      try {
        rmSync(tempArchive, { force: true })
      } catch {
        // Ignore temporary file cleanup errors.
      }
      try {
        rmSync(tempFinal, { force: true })
      } catch {
        // Ignore temporary file cleanup errors.
      }
    }
  } finally {
    releaseLock(lockPath)
  }
}
