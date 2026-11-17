import type { Resolved } from './constants'
import type { HttpError } from './errors'
import type { HttpMethod } from './types'

const MAX_RETRY_DELAY_MS = 600_000

export function shouldRetryRequest(
  error: HttpError,
  method: HttpMethod,
  attempt: number,
  maxAttempts: number,
  cfg: Resolved,
): boolean {
  if (attempt >= maxAttempts || !error.retryable) return false
  if (!cfg.retryMethods.includes(method)) return false

  return error.status !== null
    ? cfg.retryStatusCodes.includes(error.status)
    : error.code !== 'ABORTED'
}

export function computeRetryDelay(
  error: HttpError,
  attempt: number,
  cfg: Resolved,
): number {
  if (error.status === 429) {
    return Math.min(
      error.retryAfterMs ?? cfg.rateLimitDelay,
      MAX_RETRY_DELAY_MS,
    )
  }

  const base = Math.min(cfg.backoffBase * 2 ** (attempt - 1), cfg.backoffMax)
  const jittered = Math.round(base / 2 + Math.random() * (base / 2))

  if (error.retryAfterMs !== null) {
    return Math.max(jittered, Math.min(error.retryAfterMs, MAX_RETRY_DELAY_MS))
  }

  return jittered
}
