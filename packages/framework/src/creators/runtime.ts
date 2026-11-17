import type { CoreLogger } from '../utils/logger'
import type { Middlewares } from './commands/middleware'
import { CommandRegistry } from './commands/registry'
import type {
  CommandErrorHandler,
  CommandHooks,
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
  ownerIds?: readonly string[]
  hooks?: CommandHooks
  logger?: CoreLogger
}

export interface CreatorsRuntime {
  config: ResolvedCreatorsConfig
  commands: CommandRegistry
  events: EventRegistry
}

let defaultRuntime: CreatorsRuntime | undefined

export function ensureCreatorsRuntime(): CreatorsRuntime {
  defaultRuntime ??= {
    config: {},
    commands: new CommandRegistry(),
    events: new EventRegistry(),
  }
  return defaultRuntime
}

export function staticPrefixForLogs(
  prefix: PrefixResolver | undefined,
): string {
  if (typeof prefix === 'string') return prefix
  if (Array.isArray(prefix)) return prefix[0] ?? '?'
  if (typeof prefix === 'function') return '*'
  return '?'
}
