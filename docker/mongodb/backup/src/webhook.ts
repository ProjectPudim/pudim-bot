import type { BackupResult } from './backup'
import type { BackupEnv } from './env'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function parseRetryAfter(response: Response): Promise<number> {
  const header = response.headers.get('retry-after')
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000)
    }
  }

  try {
    const body = (await response.json()) as { retry_after?: number }
    if (typeof body.retry_after === 'number') {
      return Math.max(0, body.retry_after * 1000)
    }
  } catch {
    // Ignore JSON parsing errors.
  }

  return 0
}

export async function sendBackupWebhook(
  env: BackupEnv,
  result: BackupResult,
  nextBackupAt: string,
): Promise<void> {
  if (!env.webhookUrl) {
    return
  }

  if (result.size > env.maxUploadBytes) {
    await sendFailureOrStatusNotification(
      env,
      'Backup concluído, mas o arquivo excede o limite de anexo configurado.',
      [
        { name: 'Arquivo', value: result.filename, inline: false },
        { name: 'Tamanho', value: formatBytes(result.size), inline: true },
        {
          name: 'Limite',
          value: formatBytes(env.maxUploadBytes),
          inline: true,
        },
      ],
    )
    throw new Error('backup file exceeds configured upload limit')
  }

  const fileBuffer = await Bun.file(result.path).arrayBuffer()
  const embed = {
    title: 'Backup do MongoDB',
    color: 0x57f287,
    timestamp: result.createdAt,
    fields: [
      { name: 'Status', value: 'Concluído com sucesso', inline: true },
      { name: 'Banco', value: env.name, inline: true },
      {
        name: 'Data',
        value: `${new Date(result.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC`,
        inline: false,
      },
      { name: 'Tamanho', value: formatBytes(result.size), inline: true },
      { name: 'SHA-256', value: `\`${result.sha256}\``, inline: false },
      { name: 'Criptografia', value: 'AES-256-GCM', inline: true },
      { name: 'Arquivo', value: result.filename, inline: false },
      { name: 'Próximo backup', value: nextBackupAt, inline: false },
    ],
  }

  const maxAttempts = 5
  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const form = new FormData()
      form.append('payload_json', JSON.stringify({ embeds: [embed] }))
      form.append('files[0]', new Blob([fileBuffer]), result.filename)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30_000)

      let response: Response
      try {
        response = await fetch(env.webhookUrl, {
          method: 'POST',
          body: form,
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      if (response.ok) {
        return
      }

      if (response.status === 429) {
        const waitMs = await parseRetryAfter(response)
        await sleep(waitMs || Math.min(30_000, 2 ** attempt * 1_000))
        continue
      }

      if (response.status >= 500) {
        await sleep(Math.min(30_000, 2 ** attempt * 1_000))
        continue
      }

      const body = await response.text()
      throw new Error(`webhook responded with ${response.status}: ${body}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt === maxAttempts - 1) {
        break
      }
      await sleep(Math.min(30_000, 2 ** attempt * 1_000))
    }
  }

  throw lastError ?? new Error('failed to send backup webhook')
}

export async function sendFailureOrStatusNotification(
  env: BackupEnv,
  description: string,
  fields: Array<{ name: string; value: string; inline?: boolean }> = [],
): Promise<void> {
  if (!env.webhookUrl) {
    return
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    try {
      await fetch(env.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: 'Backup do MongoDB',
              color: 0xed4245,
              description,
              fields,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    // Never let notification delivery mask the original failure.
  }
}
