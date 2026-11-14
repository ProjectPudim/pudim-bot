/* eslint-disable no-console -- this module is the project's logging layer */

import { styleText } from 'node:util'

export type StyleName =
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'bold'
  | 'dim'
  | 'underline'
  | 'inverse'

export type LogLevel =
  'debug' | 'info' | 'success' | 'warn' | 'error' | 'silent'

export interface LoggerOptions {
  scope?: string
  level?: LogLevel
  timestamp?: boolean
  colors?: boolean
}

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

const colors: Record<Exclude<LogLevel, 'silent'>, StyleName> = {
  debug: 'gray',
  info: 'blue',
  success: 'green',
  warn: 'yellow',
  error: 'red',
}

export function style(text: string, ...styles: StyleName[]): string {
  if (styles.length === 0) return text

  return styleText(styles.length === 1 ? styles[0]! : styles, text)
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message
  }

  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error) ?? String(error)
    } catch {
      return String(error)
    }
  }

  return String(error)
}

export class Logger {
  readonly options: Required<Omit<LoggerOptions, 'scope'>> &
    Pick<LoggerOptions, 'scope'>

  constructor(options: LoggerOptions = {}) {
    this.options = {
      scope: options.scope,
      level: options.level ?? 'info',
      timestamp: options.timestamp ?? false,
      colors: options.colors ?? true,
    }
  }

  get scope(): string | undefined {
    return this.options.scope
  }

  line(text = ''): void {
    console.log(this.#prefix() + text)
  }

  blank(): void {
    console.log('')
  }

  info(message: string, error?: unknown): void {
    this.#write('info', message, error)
  }

  success(message: string, error?: unknown): void {
    this.#write('success', message, error)
  }

  warn(message: string, error?: unknown): void {
    this.#write('warn', message, error)
  }

  warning(message: string, error?: unknown): void {
    this.warn(message, error)
  }

  error(message: string, error?: unknown): void {
    this.#write('error', message, error)
  }

  debug(message: string, error?: unknown): void {
    this.#write('debug', message, error)
  }

  log(message: string, error?: unknown): void {
    this.info(message, error)
  }

  child(scope: string): Logger {
    return new Logger({
      ...this.options,
      scope: this.scope ? `${this.scope}:${scope}` : scope,
    })
  }

  #write(
    level: Exclude<LogLevel, 'silent'>,
    message: string,
    error?: unknown,
  ): void {
    if (levels[level] < levels[this.options.level]) {
      return
    }

    const label = this.#style(level, colors[level], 'bold')

    const detail =
      error === undefined ? '' : ` ${this.#style(formatError(error), 'gray')}`

    const output = `${this.#prefix()}${label} ${message}${detail}`

    if (level === 'error') {
      console.error(output)
    } else if (level === 'warn') {
      console.warn(output)
    } else if (level === 'debug') {
      console.debug(output)
    } else {
      console.log(output)
    }
  }

  #style(text: string, ...styles: StyleName[]): string {
    return this.options.colors ? style(text, ...styles) : text
  }

  #prefix(): string {
    const parts: string[] = []

    if (this.options.timestamp) {
      parts.push(this.#style(`[${new Date().toISOString()}]`, 'dim'))
    }

    if (this.scope) {
      parts.push(this.#style(`[${this.scope}]`, 'gray'))
    }

    return parts.length > 0 ? `${parts.join(' ')} ` : ''
  }
}

export const logger = new Logger()

export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options)
}
