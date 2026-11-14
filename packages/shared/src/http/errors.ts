import type { HttpErrorCode } from './types'

export interface HttpErrorInit {
  status?: number | null
  retryable?: boolean
  code?: HttpErrorCode
  url?: string
  data?: unknown
  headers?: Headers
  retryAfterMs?: number | null
  attempt?: number
  cause?: unknown
}

export class HttpError extends Error {
  readonly status: number | null
  readonly retryable: boolean
  readonly code: HttpErrorCode
  readonly url: string | null
  readonly data: unknown
  readonly headers: Headers | null
  readonly retryAfterMs: number | null
  attempt: number

  constructor(message: string, init: HttpErrorInit = {}) {
    super(message, { cause: init.cause })
    this.name = 'HttpError'
    this.status = init.status ?? null
    this.retryable = init.retryable ?? true
    this.code = init.code ?? 'HTTP_ERROR'
    this.url = init.url ?? null
    this.data = init.data
    this.headers = init.headers ?? null
    this.retryAfterMs = init.retryAfterMs ?? null
    this.attempt = init.attempt ?? 1
  }
}
