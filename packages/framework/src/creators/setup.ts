import { createCommand } from './commands/create'
import {
  createMiddleware,
  middlewareList,
  type Middlewares,
} from './commands/middleware'
import { CommandRegistry } from './commands/registry'
import type {
  CommandErrorHandler,
  CommandHooks,
  CommandNotFoundErrorHandler,
  CommandNotFoundHandler,
  MiddlewareStopHandler,
  PrefixResolver,
} from './commands/types'
import { createEvent } from './events/create'
import { EventRegistry } from './events/registry'
import type { EventErrorHandler } from './events/types'
import {
  ensureCreatorsRuntime,
  type CreatorsRuntime,
  type ResolvedCreatorsConfig,
} from './runtime'

export interface CommandSection {
  prefix?: PrefixResolver
  middlewares?: Middlewares
  onError?: CommandErrorHandler
  onMiddlewareStop?: MiddlewareStopHandler
  notFound?: CommandNotFoundHandler
  onNotFoundError?: CommandNotFoundErrorHandler
  ownerIds?: readonly string[]
  hooks?: CommandHooks
}

export interface EventSection {
  onError?: EventErrorHandler
}

export interface SetupCreatorsOptions {
  commands?: CommandSection
  events?: EventSection
}

export interface Creators extends CreatorsRuntime {
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

function assertHooks(hooks: unknown, label: string): void {
  if (hooks === undefined) return
  if (typeof hooks !== 'object' || hooks === null) {
    throw new Error(`[creators] ${label} must be an object.`)
  }
  for (const key of ['before', 'success', 'failure', 'finally'] as const) {
    const value = (hooks as Record<string, unknown>)[key]
    if (value !== undefined && typeof value !== 'function') {
      throw new Error(`[creators] ${label}.${key} must be a function.`)
    }
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
  if (
    commands.ownerIds !== undefined &&
    (!Array.isArray(commands.ownerIds) ||
      commands.ownerIds.some((id) => typeof id !== 'string'))
  ) {
    throw new Error('[creators] ownerIds must be an array of strings.')
  }
  assertHooks(commands.hooks, 'hooks')

  const runtime: CreatorsRuntime = {
    config: {},
    commands: new CommandRegistry(),
    events: new EventRegistry(),
  }

  const rt = runtime
  rt.config = {
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
    ...('ownerIds' in commands ? { ownerIds: commands.ownerIds } : {}),
    ...('hooks' in commands ? { hooks: commands.hooks } : {}),
    ...('onError' in events ? { onEventError: events.onError } : {}),
  }

  // Preserve global default for callers that do not pass creators to bootstrap.
  const defaultRuntime = ensureCreatorsRuntime()
  if (!defaultRuntime.config.prefix && !defaultRuntime.commands.size) {
    // only seed default if untouched
    defaultRuntime.config = { ...rt.config }
    defaultRuntime.commands = rt.commands
    defaultRuntime.events = rt.events
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
  } as Creators
}
