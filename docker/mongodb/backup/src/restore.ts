import { spawnSync } from 'node:child_process'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decryptBuffer, loadKey, sha256 } from './crypto'
import { loadEnv } from './env'

function usage(): void {
  console.info(`Usage:
  bun src/restore.ts --file <backup.enc> --uri <mongodb-uri> [--expected-sha256 <hash>] [--yes]

Environment:
  MONGODB_BACKUP_ENCRYPTION_KEY must be configured.`)
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

async function main(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const file = getArg('--file')
  const uri = getArg('--uri') ?? process.env.MONGODB_URI
  const expectedHash = getArg('--expected-sha256')
  const yes = hasFlag('--yes')

  if (!file || !uri) {
    usage()
    process.exit(1)
  }

  if (!existsSync(file)) {
    throw new Error(`backup file not found: ${file}`)
  }

  const env = loadEnv()
  const key = loadKey(
    env.encryptionKey || process.env.MONGODB_BACKUP_ENCRYPTION_KEY || '',
  )

  const encrypted = Buffer.from(await Bun.file(file).arrayBuffer())
  const actualHash = sha256(encrypted)

  if (expectedHash && actualHash !== expectedHash) {
    throw new Error(
      `hash mismatch: expected ${expectedHash}, got ${actualHash}`,
    )
  }

  console.info(`Encrypted SHA-256: ${actualHash}`)

  if (!yes) {
    console.info(
      'Refusing to restore without --yes. Re-run with --yes after reviewing the target URI.',
    )
    process.exit(2)
  }

  const decrypted = decryptBuffer(encrypted, key)
  const tempArchive = join(tmpdir(), `restore-${Date.now()}.archive.gz`)
  writeFileSync(tempArchive, decrypted)

  try {
    const result = spawnSync(
      'mongorestore',
      [`--uri=${uri}`, `--archive=${tempArchive}`, '--gzip', '--drop'],
      { stdio: 'inherit' },
    )

    if (result.status !== 0) {
      throw new Error(`mongorestore exited with code ${result.status}`)
    }

    console.info('Restore completed successfully.')
  } finally {
    try {
      unlinkSync(tempArchive)
    } catch {
      // Ignore cleanup errors.
    }
  }
}

main().catch((error) => {
  console.error(String(error))
  process.exit(1)
})
