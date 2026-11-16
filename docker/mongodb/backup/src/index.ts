import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createBackup } from './backup'
import { loadKey } from './crypto'
import { loadEnv, parseInterval } from './env'
import { sendBackupWebhook, sendFailureOrStatusNotification } from './webhook'

const env = loadEnv()

const pendingPath = join(env.dir, '.pending-uploads.json')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readPending(): string[] {
  if (!existsSync(pendingPath)) {
    return []
  }

  try {
    const parsed = JSON.parse(readFileSync(pendingPath, 'utf8'))
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function writePending(items: string[]): void {
  try {
    writeFileSync(pendingPath, JSON.stringify(items, null, 2))
  } catch {
    // Ignore state persistence errors.
  }
}

async function sha256File(path: string): Promise<string> {
  const { sha256 } = await import('./crypto')
  return sha256(Buffer.from(await Bun.file(path).arrayBuffer()))
}

async function retryPendingUploads(): Promise<void> {
  if (!env.webhookUrl) {
    return
  }

  const pending = readPending()
  if (pending.length === 0) {
    return
  }

  const remaining: string[] = []

  for (const filename of pending) {
    const filePath = join(env.dir, filename)
    if (!existsSync(filePath)) {
      continue
    }

    try {
      const createdAt = new Date().toISOString()
      const result = {
        filename,
        path: filePath,
        size: Bun.file(filePath).size,
        sha256: await sha256File(filePath),
        createdAt,
      }
      await sendBackupWebhook(
        env,
        result,
        new Date(Date.now() + parseInterval(env.interval)).toISOString(),
      )
      console.info(JSON.stringify({ status: 'pending_upload_sent', filename }))
    } catch (error) {
      remaining.push(filename)
      console.error(
        JSON.stringify({
          status: 'pending_upload_failed',
          filename,
          error: String(error),
        }),
      )
    }
  }

  writePending(remaining)
}

async function runOnce(): Promise<void> {
  await retryPendingUploads()

  try {
    const result = await createBackup(env)
    console.info(
      JSON.stringify({
        status: 'backup_created',
        filename: result.filename,
        size: result.size,
        sha256: result.sha256,
      }),
    )

    if (env.webhookUrl) {
      const nextBackupAt = new Date(
        Date.now() + parseInterval(env.interval),
      ).toISOString()
      try {
        await sendBackupWebhook(env, result, nextBackupAt)
        console.info(
          JSON.stringify({ status: 'webhook_sent', filename: result.filename }),
        )
      } catch (error) {
        writePending([...new Set([...readPending(), result.filename])])
        console.error(
          JSON.stringify({
            status: 'webhook_failed',
            filename: result.filename,
            error: String(error),
          }),
        )
        await sendFailureOrStatusNotification(
          env,
          'Backup concluído, mas o envio ao Fluxer falhou.',
          [
            { name: 'Arquivo', value: result.filename, inline: false },
            { name: 'Erro', value: String(error).slice(0, 900), inline: false },
          ],
        )
      }
    }
  } catch (error) {
    console.error(
      JSON.stringify({ status: 'backup_failed', error: String(error) }),
    )
    await sendFailureOrStatusNotification(
      env,
      'Falha ao gerar o backup do MongoDB.',
      [{ name: 'Erro', value: String(error).slice(0, 900), inline: false }],
    )
  }
}

async function main(): Promise<void> {
  mkdirSync(env.dir, { recursive: true })

  if (!env.enabled) {
    console.info(JSON.stringify({ status: 'backups_disabled' }))
    while (true) {
      await sleep(3_600_000)
    }
  }

  try {
    loadKey(env.encryptionKey)
  } catch (error) {
    console.error(
      JSON.stringify({ status: 'invalid_configuration', error: String(error) }),
    )
    process.exit(1)
  }

  if (!env.mongodbUri) {
    console.error(
      JSON.stringify({
        status: 'invalid_configuration',
        error: 'MONGODB_URI is not configured',
      }),
    )
    process.exit(1)
  }

  while (true) {
    await runOnce()
    await sleep(parseInterval(env.interval))
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'fatal', error: String(error) }))
  process.exit(1)
})
