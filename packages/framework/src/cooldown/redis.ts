export interface RedisCooldownClient {
  set(
    key: string,
    value: string,
    ...options: Array<string | number>
  ): Promise<unknown>
  pttl(key: string): Promise<number>
  del(...keys: string[]): Promise<number>
  send(command: string, args: string[]): Promise<unknown>
}

export interface RedisCooldownAdapterOptions {
  readonly prefix?: string
}

// Conditional delete: only removes the key when the stored token matches.
const RELEASE_SCRIPT = [
  "if redis.call('get', KEYS[1]) == ARGV[1] then",
  "  return redis.call('del', KEYS[1])",
  'else',
  '  return 0',
  'end',
].join(' ')

export class RedisCooldownAdapter {
  readonly #client: RedisCooldownClient
  readonly #prefix: string

  constructor(
    client: RedisCooldownClient,
    options: RedisCooldownAdapterOptions = {},
  ) {
    this.#client = client
    this.#prefix = options.prefix ?? ''
  }

  async acquire(
    key: string,
    durationMs: number,
    _options?: { now?: number },
  ): Promise<import('../utils/cooldown').CooldownAcquireResult> {
    if (
      typeof durationMs !== 'number' ||
      !Number.isFinite(durationMs) ||
      durationMs <= 0
    ) {
      throw new RangeError(
        '[cooldown] Duration must be a finite positive number (ms).',
      )
    }

    const fullKey = this.#prefix + key
    const token = crypto.randomUUID()

    let reply: unknown
    try {
      reply = await this.#client.set(fullKey, token, 'PX', durationMs, 'NX')
    } catch (error) {
      throw new Error('[cooldown] Redis acquire failed.', { cause: error })
    }

    if (reply === 'OK') {
      return { acquired: true, token }
    }

    // The key exists (or expired in the meantime). Use PTTL as the source of
    // truth for the remaining time.
    let pttl: number
    try {
      pttl = await this.#client.pttl(fullKey)
    } catch (error) {
      throw new Error('[cooldown] Redis PTTL failed.', { cause: error })
    }

    // -2: key does not exist (race). Retry once atomically.
    if (pttl === -2) {
      try {
        const retryReply = await this.#client.set(
          fullKey,
          token,
          'PX',
          durationMs,
          'NX',
        )
        if (retryReply === 'OK') {
          return { acquired: true, token }
        }
        const retryPttl = await this.#client.pttl(fullKey)
        return {
          acquired: false,
          retryAfter: retryPttl > 0 ? retryPttl : 0,
        }
      } catch (error) {
        throw new Error('[cooldown] Redis acquire retry failed.', {
          cause: error,
        })
      }
    }

    // -1: key exists without TTL (should not happen). Remove it to avoid an
    // unexpired cooldown key, then treat as not acquired with no wait.
    if (pttl === -1) {
      try {
        await this.#client.del(fullKey)
      } catch {
        // ignore cleanup errors
      }
      return { acquired: false, retryAfter: 0 }
    }

    return { acquired: false, retryAfter: pttl > 0 ? pttl : 0 }
  }

  async release(key: string, token: string): Promise<boolean> {
    const fullKey = this.#prefix + key
    try {
      const result = await this.#client.send('EVAL', [
        RELEASE_SCRIPT,
        '1',
        fullKey,
        token,
      ])
      return Number(result) === 1
    } catch (error) {
      throw new Error('[cooldown] Redis release failed.', { cause: error })
    }
  }

  async reset(key: string): Promise<void> {
    const fullKey = this.#prefix + key
    try {
      await this.#client.del(fullKey)
    } catch (error) {
      throw new Error('[cooldown] Redis reset failed.', { cause: error })
    }
  }

  // Kept for API symmetry; atomicity is enforced by SET NX.
  async has(key: string): Promise<boolean> {
    try {
      const pttl = await this.#client.pttl(this.#prefix + key)
      return pttl > 0
    } catch (error) {
      throw new Error('[cooldown] Redis has failed.', { cause: error })
    }
  }
}

// Re-export the script for tests that may want to inspect it.
export const REDIS_COOLDOWN_RELEASE_SCRIPT = RELEASE_SCRIPT
