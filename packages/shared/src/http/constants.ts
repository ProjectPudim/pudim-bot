import type { HttpMethod, ResponseType, SharedOptions } from './types'

export const DEFAULTS = {
  requestTimeout: 30_000,
  maxRetries: 3,
  retryStatusCodes: [403, 408, 425, 429, 500, 502, 503, 504] as number[],
  retryMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'] as HttpMethod[],
  backoffBase: 1000,
  backoffMax: 30_000,
  rateLimitDelay: 120_000,
  validateStatus: (status: number) => status >= 200 && status < 300,
  throwHttpErrors: true,
  responseType: 'auto' as ResponseType,
  kind: 'api' as 'api' | 'image',
  browserHeaders: true,
}

export type Resolved = typeof DEFAULTS & SharedOptions
