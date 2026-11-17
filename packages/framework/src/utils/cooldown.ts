export type CooldownScope =
  'user' | 'user-guild' | 'guild' | 'channel' | 'global'

export type CooldownAcquireResult =
  | { readonly acquired: true; readonly token: string }
  | { readonly acquired: false; readonly retryAfter: number }

export interface CooldownAdapter {
  acquire(
    key: string,
    durationMs: number,
    options?: { now?: number },
  ): Promise<CooldownAcquireResult>
  release(key: string, token: string): Promise<boolean>
  reset?(key: string): Promise<void>
}

export interface CooldownOptions {
  duration: number
  scope?: CooldownScope
}

function validateDuration(durationMs: number): void {
  if (
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  ) {
    throw new RangeError(
      '[cooldown] Duration must be a finite positive number (ms).',
    )
  }
}

export class MemoryCooldownAdapter implements CooldownAdapter {
  readonly #now: () => number
  readonly #prefix: string
  readonly #entries = new Map<string, { token: string; expiresAt: number }>()

  constructor(options?: { now?: () => number; prefix?: string }) {
    this.#now = options?.now ?? Date.now
    this.#prefix = options?.prefix ?? ''
  }

  async acquire(
    key: string,
    durationMs: number,
    options?: { now?: number },
  ): Promise<CooldownAcquireResult> {
    validateDuration(durationMs)
    const fullKey = this.#prefix + key
    const now = options?.now ?? this.#now()
    this.#sweep(now)

    const existing = this.#entries.get(fullKey)
    if (existing && existing.expiresAt > now) {
      return {
        acquired: false,
        retryAfter: existing.expiresAt - now,
      }
    }

    const token = crypto.randomUUID()
    this.#entries.set(fullKey, { token, expiresAt: now + durationMs })
    return { acquired: true, token }
  }

  async release(key: string, token: string): Promise<boolean> {
    const fullKey = this.#prefix + key
    const existing = this.#entries.get(fullKey)
    if (!existing || existing.token !== token) return false
    this.#entries.delete(fullKey)
    return true
  }

  async reset(key: string): Promise<void> {
    this.#entries.delete(this.#prefix + key)
  }

  get size(): number {
    return this.#entries.size
  }

  #sweep(now: number): void {
    for (const [key, value] of this.#entries) {
      if (value.expiresAt <= now) this.#entries.delete(key)
    }
  }
}

const defaultAdapter = new MemoryCooldownAdapter()

export function getDefaultCooldownAdapter(): CooldownAdapter {
  return defaultAdapter
}

export function cooldownKey(
  commandName: string,
  scope: CooldownScope,
  identity: {
    userId?: string | null
    guildId?: string | null
    channelId?: string | null
  },
  botIdentity?: string,
): string {
  const resolvedBotIdentity = botIdentity ?? 'default'
  const user = identity.userId ?? 'unknown'
  const guild = identity.guildId ?? 'dm'
  const channel = identity.channelId ?? 'unknown'
  let suffix: string
  switch (scope) {
    case 'user':
      suffix = `user:${user}`
      break
    case 'user-guild':
      suffix = `user-guild:${user}:${guild}`
      break
    case 'guild':
      suffix = `guild:${guild}`
      break
    case 'channel':
      suffix = `channel:${channel}`
      break
    case 'global':
      suffix = 'global'
      break
  }
  return `${resolvedBotIdentity}:${commandName}:cooldown:${suffix}`
}
