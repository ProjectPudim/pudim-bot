export { setupCreators } from './creators'
export type {
  CommandSection,
  Creators,
  EventSection,
  SetupCreatorsOptions,
} from './creators'

export { createCommand } from './creators/commands/create'
export {
  createMiddleware,
  MiddlewareStopError,
} from './creators/commands/middleware'
export { createEvent } from './creators/events/create'

export { bootstrap, DEFAULT_MODULE_PATTERNS } from './bootstrap'
export type {
  BootstrapErrorHandler,
  BootstrapOptions,
  BootstrapResult,
  ClientFactory,
  CustomBootstrapOptions,
} from './bootstrap'

export type {
  AnyCommand,
  AnyCommandContext,
  AnyEvent,
  Command,
  CommandContext,
  CommandErrorHandler,
  CommandInfo,
  CommandNotFoundContext,
  CommandNotFoundErrorHandler,
  CommandNotFoundHandler,
  CommandOptions,
  Event,
  EventErrorHandler,
  EventOptions,
  InvocationContext,
  Middleware,
  MiddlewareHandle,
  MiddlewareOptions,
  Middlewares,
  MiddlewareStopHandler,
  PrefixResolver,
  PrefixValue,
} from './creators'

export {
  attachEvent,
  attachEvents,
  CommandRegistry,
  EventRegistry,
  handleCommand,
  loadCommands,
  loadEvents,
} from './creators'
export type {
  HandleCommandOptions,
  HandleCommandResult,
  LoadCommandsOptions,
  LoadEventsOptions,
} from './creators'

export { getCommandsInfo } from './client-commands'
export {
  CommandFailureError,
  isCommandFailureError,
  type ArgumentsFailure,
  type CommandFailure,
  type CommandFailureKind,
  type ConcurrencyFailure,
  type ContextFailure,
  type CooldownFailure,
  type OwnerFailure,
  type PermissionsFailure,
  type StoppedFailure,
} from './creators/commands/failures'

export { parseCommandArgs, type ParsedCommandArgs } from './utils/args'
export {
  cooldownKey,
  getDefaultCooldownAdapter,
  MemoryCooldownAdapter,
  REDIS_COOLDOWN_RELEASE_SCRIPT,
  RedisCooldownAdapter,
  type CooldownAcquireResult,
  type CooldownAdapter,
  type CooldownOptions,
  type CooldownScope,
  type RedisCooldownAdapterOptions,
  type RedisCooldownClient,
} from './cooldown'
export {
  clearConcurrency,
  type ConcurrencyOptions,
  type ConcurrencyScope,
} from './utils/concurrency'
export { reloadModules, type ReloadResult } from './reload'

export {
  CommandState,
  createContext,
  createNotFoundContext,
  type CreateContextInput,
  type InvocationContextInput,
} from './context'

export { validateEnv } from './utils/env'
export type { StandardSchemaV1 } from './utils/standard-schema'
export type { CoreLogger } from './utils/logger'
export {
  collectModuleValues,
  DEFAULT_MODULE_EXTENSIONS,
  discoverFiles,
  expandGlob,
  globToRegExp,
  importModule,
  loadModules,
  type DiscoverFilesOptions,
  type LoadedModule,
} from './utils/loader'

export type * from './types'
