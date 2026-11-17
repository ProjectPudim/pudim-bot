import type { Middlewares } from './commands/middleware'
import { CommandRegistry } from './commands/registry'
import type {
  CommandErrorHandler,
  CommandNotFoundErrorHandler,
  CommandNotFoundHandler,
  MiddlewareStopHandler,
  PrefixResolver,
} from './commands/types'
import { EventRegistry } from './events/registry'
import type { EventErrorHandler } from './events/types'

export interface ResolvedCreatorsConfig {
  prefix?: PrefixResolver
  middlewares?: Middlewares
  onCommandError?: CommandErrorHandler
  onMiddlewareStop?: MiddlewareStopHandler
  notFound?: CommandNotFoundHandler
  onNotFoundError?: CommandNotFoundErrorHandler
  onEventError?: EventErrorHandler
}

export interface CreatorsRuntime {
  config: ResolvedCreatorsConfig
  commands: CommandRegistry
  events: EventRegistry
}

let runtime: CreatorsRuntime | undefined

/** Internal. The public entry point is `setupCreators` */
export function ensureCreatorsRuntime(): CreatorsRuntime {
  runtime ??= {
    config: {},
    commands: new CommandRegistry(),
    events: new EventRegistry(),
  }
  return runtime
}

export function staticPrefixForLogs(
  prefix: PrefixResolver | undefined,
): string {
  if (typeof prefix === 'string') return prefix
  if (Array.isArray(prefix)) return prefix[0] ?? '?'
  if (typeof prefix === 'function') return '*'
  return '?'
}
