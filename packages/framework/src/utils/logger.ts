/* eslint-disable no-console -- this module is the project's logging layer */
import * as util from 'node:util'

export type StyleName =
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'cyan'
  | 'magenta'
  | 'gray'
  | 'grey'
  | 'white'
  | 'bold'
  | 'underline'

// `styleText` may be unavailable on older runtimes; fall back to plain text
const styleText =
  typeof util.styleText === 'function' ? util.styleText : undefined

export function style(text: string, ...styles: StyleName[]): string {
  if (!styleText || styles.length === 0) return text
  const formats = styles.map((style) => (style === 'grey' ? 'gray' : style))
  return styleText(formats.length === 1 ? formats[0]! : formats, text)
}

export interface CoreLogger {
  debug(message: string, detail?: unknown): void
  info(message: string, detail?: unknown): void
  success(message: string, detail?: unknown): void
  warn(message: string, detail?: unknown): void
  error(message: string, detail?: unknown): void
  line(text?: string): void
  blank(): void
}

type LogLabel = 'debug' | 'info' | 'success' | 'warn' | 'error'

const labelColors: Record<LogLabel, StyleName> = {
  debug: 'gray',
  info: 'blue',
  success: 'green',
  warn: 'yellow',
  error: 'red',
}

export class Logger implements CoreLogger {
  constructor(readonly scope?: string) {}

  line(text = ''): void {
    console.log(this.#prefix() + text)
  }

  blank(): void {
    console.log('')
  }

  debug(message: string, detail?: unknown): void {
    this.#write('debug', message, detail)
  }

  info(message: string, detail?: unknown): void {
    this.#write('info', message, detail)
  }

  success(message: string, detail?: unknown): void {
    this.#write('success', message, detail)
  }

  warn(message: string, detail?: unknown): void {
    this.#write('warn', message, detail)
  }

  error(message: string, detail?: unknown): void {
    this.#write('error', message, detail)
  }

  log(message: string, detail?: unknown): void {
    this.info(message, detail)
  }

  #write(label: LogLabel, message: string, detail: unknown): void {
    const extra =
      detail === undefined ? '' : ` ${style(formatError(detail), 'gray')}`
    const tag = style(label, labelColors[label])
    const output = `${this.#prefix()}${tag} ${message}${extra}`
    if (label === 'error') console.error(output)
    else console.log(output)
  }

  #prefix(): string {
    return this.scope ? `${style(`[${this.scope}]`, 'gray')} ` : ''
  }
}

export function formatError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error) ?? String(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

const defaultLogger = new Logger()
let activeLogger: CoreLogger = defaultLogger

/** Called by `bootstrap`; passing `undefined` restores the default logger */
export function setLogger(next: CoreLogger | undefined): void {
  activeLogger = next ?? defaultLogger
}

// Delegates to the active logger so modules can keep importing `logger`
export const logger: CoreLogger = {
  debug: (message, detail) => activeLogger.debug(message, detail),
  info: (message, detail) => activeLogger.info(message, detail),
  success: (message, detail) => activeLogger.success(message, detail),
  warn: (message, detail) => activeLogger.warn(message, detail),
  error: (message, detail) => activeLogger.error(message, detail),
  line: (text) => activeLogger.line(text),
  blank: () => activeLogger.blank(),
}
