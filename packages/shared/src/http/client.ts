import {
  browserHeaders,
  buildProfiles,
  detectChromeMajor,
  pickProfile,
} from './browser'
import { DEFAULTS, type Resolved } from './constants'
import { HttpError } from './errors'
import type {
  BodyType,
  BrowserProfile,
  FetchInit,
  HttpClientOptions,
  HttpMethod,
  HttpResponse,
  QueryValue,
  RequestOptions,
  ResponseType,
} from './types'
import {
  abortError,
  defined,
  isPlainObject,
  parseRetryAfter,
  sleep,
} from './utils'

export class HttpClient {
  private static profiles: BrowserProfile[] = []
  private static initPromise: Promise<void> | null = null

  private readonly opts: HttpClientOptions
  private readonly siteOrigin: string
  private readonly logger: ((message: string) => void) | null
  private profile: BrowserProfile | null = null
  private nextSlotAt = 0

  constructor(options: HttpClientOptions = {}) {
    this.opts = options
    this.siteOrigin = (options.siteOrigin || 'https://google.com').replace(
      /\/+$/,
      '',
    )
    this.logger =
      typeof options.debug === 'function'
        ? options.debug
        : options.debug
          ? (m) => console.info(`[http] ${m}`)
          : null
  }

  async init(): Promise<void> {
    if (HttpClient.profiles.length === 0) {
      HttpClient.initPromise ??= (async () => {
        const fallback = this.opts.fallbackChromeMajor ?? 155
        const major =
          this.opts.detectChromeVersion === false
            ? fallback
            : await detectChromeMajor(fallback)
        HttpClient.profiles = buildProfiles(major)
      })()
      await HttpClient.initPromise
    }
    this.profile ??= pickProfile(HttpClient.profiles)
  }

  rotateProfile(): BrowserProfile {
    this.profile = pickProfile(HttpClient.profiles, this.profile)
    return this.profile
  }

  private log(message: string): void {
    this.logger?.(message)
  }

  // The slot is reserved before waiting so concurrent calls don't fire together
  private async throttle(signal?: AbortSignal): Promise<void> {
    const interval = this.opts.requestInterval ?? 0
    if (interval <= 0) return
    const now = Date.now()
    const slot = Math.max(now, this.nextSlotAt)
    this.nextSlotAt = slot + interval
    if (slot > now) await sleep(slot - now, signal)
  }

  private buildUrl(url: string, cfg: Resolved): URL {
    let target: URL
    try {
      const relative = cfg.baseURL && !/^[a-z][a-z\d+\-.]*:\/\//i.test(url)
      target = relative
        ? new URL(
            url.replace(/^\/+/, ''),
            cfg.baseURL!.endsWith('/') ? cfg.baseURL : `${cfg.baseURL}/`,
          )
        : new URL(url)
    } catch (cause) {
      throw new HttpError(`URL inválida: ${url}`, {
        code: 'INVALID_REQUEST',
        retryable: false,
        cause,
      })
    }

    const { params } = cfg
    const entries: Array<[string, QueryValue]> =
      params instanceof URLSearchParams
        ? [...params.entries()]
        : Object.entries(params ?? {}).flatMap(([k, v]) =>
            (Array.isArray(v) ? v : [v]).map((i): [string, QueryValue] => [
              k,
              i,
            ]),
          )
    for (const [key, value] of entries) {
      if (value !== null && value !== undefined)
        target.searchParams.append(
          key,
          value instanceof Date ? value.toISOString() : String(value),
        )
    }
    return target
  }

  private async parseBody(res: Response, type: ResponseType): Promise<unknown> {
    const contentType = res.headers.get('content-type') ?? ''
    if (type === 'stream') return res.body
    if (
      type === 'buffer' ||
      (type === 'auto' &&
        /^(image|audio|video)\/|octet-stream|pdf|zip/i.test(contentType))
    ) {
      return Buffer.from(await res.arrayBuffer())
    }

    const text = await res.text()
    if (type === 'text' || (type === 'auto' && !/json/i.test(contentType)))
      return text
    if (!text.trim()) return null
    try {
      return JSON.parse(text)
    } catch (cause) {
      if (type === 'json')
        throw new HttpError('JSON inválido na resposta.', {
          code: 'PARSE',
          retryable: false,
          status: res.status,
          cause,
        })
      return text
    }
  }

  private async send<T>(
    url: URL,
    method: HttpMethod,
    options: RequestOptions,
    cfg: Resolved,
    attempt: number,
    startedAt: number,
  ): Promise<HttpResponse<T>> {
    const headers = cfg.browserHeaders
      ? browserHeaders(
          cfg,
          url,
          this.profile ?? pickProfile(HttpClient.profiles),
          this.siteOrigin,
        )
      : new Headers()
    for (const [key, value] of Object.entries({
      ...this.opts.headers,
      ...options.headers,
    })) {
      if (value === null || value === undefined) headers.delete(key)
      else headers.set(key, String(value))
    }

    let body = options.body
    if (options.json !== undefined) {
      if (!headers.has('content-type'))
        headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.json)
    } else if (typeof FormData !== 'undefined' && body instanceof FormData) {
      // fetch must generate the Content-Type with the multipart boundary
      headers.delete('content-type')
    }

    const controller = new AbortController()
    let timedOut = false
    const timer =
      cfg.requestTimeout > 0
        ? setTimeout(
            () => ((timedOut = true), controller.abort()),
            cfg.requestTimeout,
          )
        : null
    const onAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onAbort, { once: true })

    const init: FetchInit = { method, headers, signal: controller.signal }
    if (method !== 'GET' && method !== 'HEAD' && body !== undefined)
      init.body = body
    Object.assign(init, cfg.fetchOptions)

    const info = { url: url.toString(), attempt }
    try {
      await cfg.hooks?.beforeRequest?.({ url, headers, init, attempt })

      if (options.signal?.aborted) throw abortError()

      this.log(`${method} ${url} (tentativa ${attempt})`)
      const res = await fetch(url, init)
      if (cfg.responseType === 'stream' && timer) clearTimeout(timer)

      const result = (data: unknown): HttpResponse<T> => ({
        data: data as T,
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        url: res.url || url.toString(),
        ok: res.ok,
        attempts: attempt,
        durationMs: Date.now() - startedAt,
      })

      if (cfg.validateStatus(res.status))
        return result(await this.parseBody(res, cfg.responseType))

      const errorData = await this.parseBody(res, 'auto').catch(() => undefined)
      if (!cfg.throwHttpErrors) return result(errorData)

      throw new HttpError(`HTTP ${res.status} ${res.statusText}`.trim(), {
        ...info,
        status: res.status,
        retryable: res.status !== 404 && res.status !== 410,
        data: errorData,
        headers: res.headers,
        retryAfterMs: parseRetryAfter(res.headers.get('retry-after')),
      })
    } catch (error) {
      if (error instanceof HttpError) throw error
      if (timedOut)
        throw new HttpError(`Timeout após ${cfg.requestTimeout}ms`, {
          ...info,
          code: 'TIMEOUT',
          cause: error,
        })
      if (options.signal?.aborted)
        throw new HttpError('Requisição abortada.', {
          ...info,
          code: 'ABORTED',
          retryable: false,
          cause: error,
        })
      throw new HttpError(
        error instanceof Error ? error.message : String(error),
        { ...info, code: 'NETWORK', cause: error },
      )
    } finally {
      if (timer) clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }
  }

  async request<T = unknown>(
    url: string,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    await this.init()

    const cfg: Resolved = {
      ...DEFAULTS,
      ...defined(this.opts),
      ...defined(options),
    }
    cfg.hooks = { ...this.opts.hooks, ...options.hooks }
    const method = (options.method ?? 'GET').toUpperCase() as HttpMethod
    const target = this.buildUrl(url, cfg)
    const maxAttempts = Math.max(0, cfg.maxRetries) + 1
    const startedAt = Date.now()
    let lastError: HttpError | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.throttle(options.signal)
        const response = await this.send<T>(
          target,
          method,
          options,
          cfg,
          attempt,
          startedAt,
        )
        return (
          ((await cfg.hooks.afterResponse?.(
            response,
          )) as HttpResponse<T> | void) ?? response
        )
      } catch (error) {
        lastError =
          error instanceof HttpError
            ? error
            : new HttpError(String(error), {
                code: 'NETWORK',
                url: target.toString(),
                cause: error,
              })
        lastError.attempt = attempt
      }

      if (lastError.status === 403)
        this.log(`Perfil trocado para ${this.rotateProfile().name}`)

      const retryableCause =
        lastError.status !== null
          ? cfg.retryStatusCodes.includes(lastError.status)
          : lastError.code !== 'ABORTED'
      if (
        attempt >= maxAttempts ||
        !lastError.retryable ||
        !retryableCause ||
        !cfg.retryMethods.includes(method)
      )
        break

      // Retry-After and 429 take priority over the exponential backoff
      const base = Math.min(
        cfg.backoffBase * 2 ** (attempt - 1),
        cfg.backoffMax,
      )
      let delay = Math.round(base / 2 + Math.random() * (base / 2))
      if (lastError.status === 429)
        delay = Math.min(lastError.retryAfterMs ?? cfg.rateLimitDelay, 600_000)
      else if (lastError.retryAfterMs !== null)
        delay = Math.max(delay, Math.min(lastError.retryAfterMs, 600_000))

      await cfg.hooks.beforeRetry?.({
        error: lastError,
        attempt,
        maxAttempts,
        delayMs: delay,
      })
      this.log(
        `RETRY ${method} ${target} em ${delay}ms (${attempt}/${maxAttempts}): ${lastError.message}`,
      )

      try {
        await sleep(delay, options.signal)
      } catch (abort) {
        lastError = abort as HttpError
        break
      }
    }

    throw (
      lastError ??
      new HttpError('Falha na requisição HTTP.', { url: target.toString() })
    )
  }

  get<T = unknown>(url: string, options: RequestOptions = {}) {
    return this.request<T>(url, { ...options, method: 'GET' })
  }

  async getJson<T = unknown>(
    url: string,
    options: RequestOptions = {},
  ): Promise<T> {
    return (await this.get<T>(url, { ...options, responseType: 'json' })).data
  }

  post<T = unknown>(url: string, data?: unknown, options: RequestOptions = {}) {
    return this.withBody<T>('POST', url, data, options)
  }

  put<T = unknown>(url: string, data?: unknown, options: RequestOptions = {}) {
    return this.withBody<T>('PUT', url, data, options)
  }

  patch<T = unknown>(
    url: string,
    data?: unknown,
    options: RequestOptions = {},
  ) {
    return this.withBody<T>('PATCH', url, data, options)
  }

  delete<T = unknown>(url: string, options: RequestOptions = {}) {
    return this.request<T>(url, { ...options, method: 'DELETE' })
  }

  // Objects and arrays become JSON; any other value is sent as a raw body
  private withBody<T>(
    method: HttpMethod,
    url: string,
    data: unknown,
    options: RequestOptions,
  ) {
    const asJson = isPlainObject(data) || Array.isArray(data)
    return this.request<T>(url, {
      ...options,
      method,
      ...(asJson ? { json: data } : { body: data as BodyType }),
    })
  }

  // Headers are merged; hooks and other overridden options replace the current ones
  extend(overrides: HttpClientOptions = {}): HttpClient {
    return new HttpClient({
      ...this.opts,
      ...defined(overrides),
      headers: { ...this.opts.headers, ...overrides.headers },
      hooks: { ...this.opts.hooks, ...overrides.hooks },
    })
  }

  static isHttpError(error: unknown): error is HttpError {
    return error instanceof HttpError
  }

  isHttpError(error: unknown): error is HttpError {
    return HttpClient.isHttpError(error)
  }
}

export const http = new HttpClient()
