// `create*` functions are only available through `setupCreators()`.

export { setupCreators } from './creators'
export type {
  CommandSection,
  Creators,
  EventSection,
  SetupCreatorsOptions,
} from './creators'

export { bootstrap, DEFAULT_MODULE_PATTERNS } from './bootstrap'
export type {
  BootstrapErrorHandler,
  BootstrapOptions,
  BootstrapResult,
  ClientFactory,
  CustomBootstrapOptions,
} from './bootstrap'

export { MiddlewareStopError } from './creators'
export type {
  AnyCommand,
  AnyCommandContext,
  Command,
  CommandContext,
  CommandErrorHandler,
  CommandInfo,
  CommandNotFoundContext,
  CommandNotFoundErrorHandler,
  CommandNotFoundHandler,
  CommandOptions,
  MiddlewareStopHandler,
  InvocationContext,
  Middleware,
  MiddlewareHandle,
  MiddlewareOptions,
  Middlewares,
  PrefixResolver,
  PrefixValue,
  AnyEvent,
  Event,
  EventErrorHandler,
  EventOptions,
} from './creators'

export {
  CommandRegistry,
  EventRegistry,
  attachEvent,
  attachEvents,
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
  type CommandFailure,
} from './creators/commands/failures'
export type { ParsedCommandArgs } from './utils/args'
export { parseCommandArgs } from './utils/args'
export {
  getDefaultCooldownAdapter,
  MemoryCooldownAdapter,
} from './utils/cooldown'
export type {
  CooldownAdapter,
  CooldownAcquireResult,
  CooldownScope,
  CooldownOptions,
} from './utils/cooldown'
export { clearConcurrency } from './utils/concurrency'
export type { ConcurrencyScope, ConcurrencyOptions } from './utils/concurrency'
export { reloadModules } from './reload'
export type { ReloadResult } from './reload'

export { CommandState, createContext, createNotFoundContext } from './context'
export type { CreateContextInput, InvocationContextInput } from './context'

export { validateEnv } from './utils/env'
export type { StandardSchemaV1 } from './utils/standard-schema'
export type { CoreLogger } from './utils/logger'
export {
  DEFAULT_MODULE_EXTENSIONS,
  collectModuleValues,
  discoverFiles,
  expandGlob,
  globToRegExp,
  importModule,
  loadModules,
} from './utils/loader'
export type { DiscoverFilesOptions, LoadedModule } from './utils/loader'

export type * from './types'
