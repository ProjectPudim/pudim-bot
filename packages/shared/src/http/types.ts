import type { HttpError } from './errors'

// Derived from fetch itself so tsconfig doesn't need the "DOM" lib
export type FetchInit = NonNullable<Parameters<typeof fetch>[1]>
export type BodyType = FetchInit['body']
export type Awaitable<T> = T | Promise<T>

export type HttpMethod =
  'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type ResponseType = 'auto' | 'json' | 'text' | 'buffer' | 'stream'
export type HttpErrorCode =
  'HTTP_ERROR' | 'TIMEOUT' | 'ABORTED' | 'NETWORK' | 'PARSE' | 'INVALID_REQUEST'

export type QueryValue = string | number | boolean | Date | null | undefined
export type QueryParams =
  Record<string, QueryValue | QueryValue[]> | URLSearchParams
export type HeadersInput = Record<
  string,
  string | number | boolean | null | undefined
>

export interface BrowserProfile {
  name: string
  ua: string
  secChUa: string
  platform: 'Windows' | 'macOS'
}

export interface HttpResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Headers
  url: string
  ok: boolean
  /** 1 when no retry happened */
  attempts: number
  durationMs: number
}

export interface RetryInfo {
  error: HttpError
  attempt: number
  maxAttempts: number
  delayMs: number
}

export interface HttpHooks {
  beforeRequest?: (ctx: {
    url: URL
    headers: Headers
    init: FetchInit
    attempt: number
  }) => Awaitable<void>
  afterResponse?: (res: HttpResponse) => Awaitable<HttpResponse | void>
  beforeRetry?: (info: RetryInfo) => Awaitable<void>
}

export interface SharedOptions {
  baseURL?: string
  headers?: HeadersInput
  params?: QueryParams
  /** Per attempt, in ms. 0 disables it */
  requestTimeout?: number
  /** Retries after the first attempt */
  maxRetries?: number
  retryStatusCodes?: number[]
  retryMethods?: HttpMethod[]
  backoffBase?: number
  backoffMax?: number
  /** Wait used on 429 when there is no Retry-After header (ms) */
  rateLimitDelay?: number
  validateStatus?: (status: number) => boolean
  /** false returns the response even when the status is invalid */
  throwHttpErrors?: boolean
  responseType?: ResponseType
  kind?: 'api' | 'image'
  /** false omits the Referer header */
  referer?: string | false
  userAgent?: string
  browserHeaders?: boolean
  /** Passed through to fetch, e.g. `proxy` on Bun or `redirect` */
  fetchOptions?: Record<string, unknown>
  hooks?: HttpHooks
}

export interface HttpClientOptions extends SharedOptions {
  siteOrigin?: string
  fallbackChromeMajor?: number
  detectChromeVersion?: boolean
  /** Minimum gap between request starts (ms) */
  requestInterval?: number
  debug?: boolean | ((message: string) => void)
}

export interface RequestOptions extends SharedOptions {
  method?: HttpMethod
  body?: BodyType
  json?: unknown
  signal?: AbortSignal
}
