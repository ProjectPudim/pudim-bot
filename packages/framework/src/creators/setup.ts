import { createCommand } from './commands/create'
import {
  createMiddleware,
  middlewareList,
  type Middlewares,
} from './commands/middleware'
import type { CommandRegistry } from './commands/registry'
import type {
  CommandErrorHandler,
  CommandNotFoundErrorHandler,
  CommandNotFoundHandler,
  MiddlewareStopHandler,
  PrefixResolver,
} from './commands/types'
import { createEvent } from './events/create'
import type { EventRegistry } from './events/registry'
import type { EventErrorHandler } from './events/types'
import { ensureCreatorsRuntime, type ResolvedCreatorsConfig } from './runtime'

export interface CommandSection {
  prefix?: PrefixResolver
  /** Run before the command's own middlewares */
  middlewares?: Middlewares
  /** Any error thrown by a middleware or by the command's `run` */
  onError?: CommandErrorHandler
  /** A middleware called `middle.stop()` */
  onMiddlewareStop?: MiddlewareStopHandler
  notFound?: CommandNotFoundHandler
  onNotFoundError?: CommandNotFoundErrorHandler
}

export interface EventSection {
  onError?: EventErrorHandler
}

export interface SetupCreatorsOptions {
  commands?: CommandSection
  events?: EventSection
}

/** The only place where `create*` functions are exposed */
export interface Creators {
  createCommand: typeof createCommand
  createEvent: typeof createEvent
  createMiddleware: typeof createMiddleware
  commands: CommandRegistry
  events: EventRegistry
  readonly config: ResolvedCreatorsConfig
}

function assertPrefix(prefix: unknown): void {
  if (
    prefix !== undefined &&
    prefix !== null &&
    typeof prefix !== 'string' &&
    typeof prefix !== 'function' &&
    (!Array.isArray(prefix) ||
      prefix.some((value) => typeof value !== 'string'))
  ) {
    throw new Error(
      '[commands] Prefix must be a string, an array of strings, or a resolver function.',
    )
  }
}

export function setupCreators(options: SetupCreatorsOptions = {}): Creators {
  const commands = options.commands ?? {}
  const events = options.events ?? {}

  assertPrefix(commands.prefix)
  middlewareList(commands.middlewares)
  for (const [name, handler] of Object.entries({
    onError: commands.onError,
    onMiddlewareStop: commands.onMiddlewareStop,
    notFound: commands.notFound,
    onNotFoundError: commands.onNotFoundError,
    onEventError: events.onError,
  })) {
    if (handler !== undefined && typeof handler !== 'function')
      throw new Error(`[creators] ${name} must be a function.`)
  }

  const rt = ensureCreatorsRuntime()

  // Only keys that were actually passed override the previous config
  rt.config = {
    ...rt.config,
    ...('prefix' in commands ? { prefix: commands.prefix } : {}),
    ...('middlewares' in commands ? { middlewares: commands.middlewares } : {}),
    ...('onError' in commands ? { onCommandError: commands.onError } : {}),
    ...('onMiddlewareStop' in commands
      ? { onMiddlewareStop: commands.onMiddlewareStop }
      : {}),
    ...('notFound' in commands ? { notFound: commands.notFound } : {}),
    ...('onNotFoundError' in commands
      ? { onNotFoundError: commands.onNotFoundError }
      : {}),
    ...('onError' in events ? { onEventError: events.onError } : {}),
  }

  return {
    createCommand,
    createEvent,
    createMiddleware,
    commands: rt.commands,
    events: rt.events,
    get config() {
      return rt.config
    },
  }
}
