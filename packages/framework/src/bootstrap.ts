import { styleText } from 'node:util'
import {
  Client,
  createLogger,
  Events,
  type ClientOptions,
  type LogLevel,
  type Message,
} from '@fluxerjs/core'
import { installClientCommands } from './client-commands'
import { handleCommand } from './creators/commands/handle'
import type { CommandRegistry } from './creators/commands/registry'
import {
  isCommand,
  type AnyCommand,
  type AnyCommandContext,
} from './creators/commands/types'
import { attachEvent, setEventRuntime } from './creators/events/loader'
import type { EventRegistry } from './creators/events/registry'
import { isEvent, type AnyEvent } from './creators/events/types'
import {
  ensureCreatorsRuntime,
  staticPrefixForLogs,
  type CreatorsRuntime,
} from './creators/runtime'
import type { Creators } from './creators/setup'
import { setReloader, type ReloadResult } from './reload'
import { MemoryCooldownAdapter } from './utils/cooldown'
import {
  collectModuleValues,
  loadModules,
  type LoadedModule,
} from './utils/loader'
import { logger, setLogger, style, type CoreLogger } from './utils/logger'

export type BootstrapErrorHandler = (
  error: unknown,
  client: Client,
) => void | Promise<void>

export type ClientFactory<TClient extends Client = Client> = (
  options: ClientOptions,
) => TClient

export interface BootstrapOptions extends Omit<ClientOptions, 'logger'> {
  meta: ImportMeta
  /** Falls back to `BOT_TOKEN` / `FLUXER_BOT_TOKEN` */
  token?: string
  /** Replaces the default `uncaughtException` / `unhandledRejection` handler */
  errorHandler?: BootstrapErrorHandler
  createClient?: ClientFactory
  beforeLoad?(client: Client): Promise<void> | void
  /** Extra glob patterns; prefix with `!` to exclude */
  modules?: string[]
  /** Fully replaces the default glob patterns */
  modulePatterns?: string[]
  /** Receives the core's logs and the SDK's. The SDK level comes from `logLevel` */
  logger?: CoreLogger
  loadLogs?: boolean
  env?: Record<string, unknown>
  ignoreBots?: boolean
  /** Injects global extensions into `ctx` before middlewares and `run` */
  decorateContext?: (ctx: AnyCommandContext) => void | Promise<void>
  /** Application-provided bot owner ids */
  ownerIds?: readonly string[]
  /** Infrastructure adapters */
  adapters?: {
    cooldown?: import('./utils/cooldown').CooldownAdapter
  }
  /** Cooldown unavailability policy */
  cooldownPolicy?: 'block' | 'allow'
  /** Namespace for cooldown keys */
  namespace?: string
  /** Explicit bot identity for cooldown keys */
  botId?: string
  /** Optional creators runtime returned by setupCreators() */
  creators?: Creators | CreatorsRuntime
}

export type CustomBootstrapOptions<TClient extends Client> = Omit<
  BootstrapOptions,
  'createClient'
> & {
  createClient: ClientFactory<TClient>
}

export interface BootstrapResult<TClient extends Client = Client> {
  client: TClient
  imports: LoadedModule[]
  commands: CommandRegistry
  events: EventRegistry
  reload(): Promise<ReloadResult>
  /** Detaches framework listeners and global handlers; does not disconnect the client */
  dispose(): void
}

const MODULE_EXTENSIONS = '{ts,js,mts,mjs,cts,cjs}'

export const DEFAULT_MODULE_PATTERNS: readonly string[] = [
  `./fluxer/**/*.${MODULE_EXTENSIONS}`,
  `!./fluxer/index.${MODULE_EXTENSIONS}`,
]

export function bootstrap<TClient extends Client>(
  options: CustomBootstrapOptions<TClient>,
): Promise<BootstrapResult<TClient>>
export function bootstrap(
  options: BootstrapOptions,
): Promise<BootstrapResult<Client>>
export async function bootstrap(
  options: BootstrapOptions,
): Promise<BootstrapResult<Client>> {
  const token =
    options.token ??
    options.env?.BOT_TOKEN ??
    options.env?.FLUXER_BOT_TOKEN ??
    process.env.BOT_TOKEN ??
    process.env.FLUXER_BOT_TOKEN
  if (typeof token !== 'string' || !token) {
    throw new Error(
      '[bootstrap] Token not provided. Pass `token`, set `env.BOT_TOKEN` ' +
        '(or `FLUXER_BOT_TOKEN`), or the corresponding environment variable.',
    )
  }

  const {
    meta,
    errorHandler,
    createClient,
    beforeLoad,
    modules,
    modulePatterns,
    logger: appLogger,
    loadLogs,
    ignoreBots,
    decorateContext,
    ownerIds,
    adapters,
    cooldownPolicy,
    namespace,
    botId,
    creators,
    logLevel,
    ...clientOptions
  } = options

  if (appLogger) setLogger(appLogger)
  const resolvedClientOptions: ClientOptions = {
    ...clientOptions,
    logLevel,
    logger: appLogger && toSdkLogger(appLogger, logLevel),
  }
  const client =
    createClient?.(resolvedClientOptions) ?? new Client(resolvedClientOptions)

  const runtime: CreatorsRuntime =
    (creators as CreatorsRuntime | undefined) ?? ensureCreatorsRuntime()
  if (ownerIds) runtime.config.ownerIds = [...ownerIds]
  if (appLogger) runtime.config.logger = appLogger
  setEventRuntime(client, runtime)

  const cooldownAdapter =
    adapters?.cooldown ??
    new MemoryCooldownAdapter({ prefix: namespace ?? 'pudim' })

  installClientCommands(client, runtime.commands)

  const patterns = modulePatterns
    ? [...modulePatterns]
    : [...DEFAULT_MODULE_PATTERNS, ...(modules ?? [])]
  const showLogs = loadLogs ?? true
  let imports: LoadedModule[] = []
  let registered: RegisteredCounts = { commands: [], events: [], ignored: 0 }
  let detachPipeline: () => void = () => undefined
  let disposed = false
  let reloading = false
  let generation = 0

  const handleGlobalError =
    errorHandler &&
    ((error: unknown) => {
      void Promise.resolve()
        .then(() => errorHandler(error, client))
        .catch((handlerError: unknown) => {
          logger.error('[bootstrap] Global error handler failed', handlerError)
        })
    })

  if (handleGlobalError) {
    process.on('uncaughtException', handleGlobalError)
    process.on('unhandledRejection', handleGlobalError)
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    setReloader(client, undefined)
    detachPipeline()
    deactivate(registered, runtime)
    if (appLogger) setLogger(undefined)
    if (handleGlobalError) {
      process.off('uncaughtException', handleGlobalError)
      process.off('unhandledRejection', handleGlobalError)
    }
  }

  const reload = async (): Promise<ReloadResult> => {
    if (disposed) throw new Error('[reload] The bootstrap was disposed.')
    if (reloading) throw new Error('[reload] A reload is already in progress.')
    reloading = true
    try {
      const fresh = await loadModules(meta, patterns, ++generation)
      const next = collectExports(fresh)
      const previous = registered
      deactivate(previous, runtime)
      try {
        activate(next, runtime, client)
      } catch (error) {
        activate(previous, runtime, client)
        throw error
      }
      registered = next
      imports = fresh
      if (showLogs) {
        logger.success(
          `Reloaded ${next.commands.length} command(s) and ${next.events.length} event(s).`,
        )
      }
      return {
        files: fresh.length,
        commands: next.commands.length,
        events: next.events.length,
      }
    } finally {
      reloading = false
    }
  }

  try {
    if (beforeLoad) await beforeLoad(client)

    imports = await loadModules(meta, patterns)

    const collected = collectExports(imports)
    activate(collected, runtime, client)
    registered = collected

    detachPipeline = attachCommandPipeline(client, runtime, {
      ignoreBots,
      decorateContext,
      showLogs,
      ownerIds: ownerIds ?? runtime.config.ownerIds,
      cooldownAdapter,
      cooldownPolicy,
      botId,
    })

    if (showLogs) {
      printLoadLogs(runtime, registered)
    }

    await client.login(token)

    if (showLogs) {
      logger.blank()
      logger.line(
        `${style(`${client.user ? client.user.username : 'Bot'}`, 'green', 'underline')} ${style('application is ready!', 'green')}`,
      )
    }

    setReloader(client, reload)

    return {
      client,
      get imports() {
        return imports
      },
      commands: runtime.commands,
      events: runtime.events,
      reload,
      dispose,
    }
  } catch (error) {
    dispose()
    throw error
  }
}

interface RegisteredCounts {
  commands: AnyCommand[]
  events: AnyEvent[]
  ignored: number
}

function collectExports(imports: LoadedModule[]): RegisteredCounts {
  const registered: RegisteredCounts = {
    commands: [],
    events: [],
    ignored: 0,
  }
  const seen = new Set<unknown>()

  for (const { file, module } of imports) {
    let matched = false

    for (const value of collectModuleValues(module)) {
      if (isCommand(value)) {
        matched = true
        if (seen.has(value)) continue
        seen.add(value)
        registered.commands.push({ ...value, file })
        continue
      }

      if (isEvent(value)) {
        matched = true
        if (seen.has(value)) continue
        seen.add(value)
        registered.events.push({ ...value, file })
      }
    }

    if (!matched) registered.ignored += 1
  }

  return registered
}

function activate(
  registered: RegisteredCounts,
  runtime: CreatorsRuntime,
  client: Client,
): void {
  runtime.commands.registerAll(registered.commands)
  try {
    runtime.events.registerAll(registered.events)
  } catch (error) {
    for (const command of registered.commands)
      runtime.commands.unregister(command.name)
    throw error
  }
  try {
    for (const event of registered.events) {
      runtime.events.trackAttachment(event, attachEvent(client, event))
    }
  } catch (error) {
    deactivate(registered, runtime)
    throw error
  }
}

function deactivate(
  registered: RegisteredCounts,
  runtime: CreatorsRuntime,
): void {
  for (const event of registered.events) runtime.events.unregister(event)
  for (const command of registered.commands)
    runtime.commands.unregister(command.name)
}

const commandPipelines = new WeakMap<Client, () => void>()

interface AttachPipelineOptions {
  ignoreBots?: boolean
  decorateContext?: (ctx: AnyCommandContext) => void | Promise<void>
  showLogs?: boolean
  ownerIds?: readonly string[]
  cooldownAdapter?: import('./utils/cooldown').CooldownAdapter
  cooldownPolicy?: 'block' | 'allow'
  botId?: string
}

function attachCommandPipeline(
  client: Client,
  runtime: CreatorsRuntime,
  options: AttachPipelineOptions,
): () => void {
  commandPipelines.get(client)?.()
  if (
    !runtime.config.prefix &&
    runtime.commands.size > 0 &&
    (options.showLogs ?? true)
  ) {
    logger.warn(
      `${runtime.commands.size} command(s) registered, but NO prefix was defined — ` +
        `command pipeline DISABLED. Set one in ` +
        `setupCreators({ commands: { prefix: '!' } }).`,
    )
  }

  const listener = (message: Message) => {
    const prefix = runtime.config.prefix
    if (!prefix) return

    void handleCommand(client, message, {
      registry: runtime.commands,
      prefix,
      ignoreBots: options.ignoreBots,
      decorateContext: options.decorateContext,
      middlewares: runtime.config.middlewares,
      onError: runtime.config.onCommandError,
      onMiddlewareStop: runtime.config.onMiddlewareStop,
      notFound: runtime.config.notFound,
      onNotFoundError: runtime.config.onNotFoundError,
      ownerIds: options.ownerIds ?? runtime.config.ownerIds,
      hooks: runtime.config.hooks,
      logger: runtime.config.logger,
      cooldownAdapter: options.cooldownAdapter,
      cooldownPolicy: options.cooldownPolicy,
      botIdentity: options.botId ?? client.user?.id,
    }).catch((error: unknown) => {
      logger.error('[bootstrap] Command pipeline failed', error)
    })
  }
  client.on(Events.MessageCreate, listener)
  const dispose = () => {
    client.off(Events.MessageCreate, listener)
    if (commandPipelines.get(client) === dispose)
      commandPipelines.delete(client)
  }
  commandPipelines.set(client, dispose)
  return dispose
}

function toSdkLogger(target: CoreLogger, level: LogLevel = 'warn') {
  return createLogger({
    level,
    sink: (sinkLevel, message, fields) => target[sinkLevel](message, fields),
  })
}

function printLoadLogs(
  runtime: CreatorsRuntime,
  registered: RegisteredCounts,
): void {
  const prefix = staticPrefixForLogs(runtime.config.prefix)
  let previousBlock = false

  if (registered.commands.length > 0) {
    logger.blank()
    logger.line(styleText('dim', 'Commands loaded:'))
    for (const command of registered.commands) {
      const category = (command as { category?: string }).category ?? '-'
      logger.line(
        [
          style(`[${prefix}] Command`, 'green'),
          style('>', 'gray'),
          style(category, 'green'),
          style('>', 'gray'),
          style(command.name, 'blue'),
          style('✓', 'green'),
        ].join(' '),
      )
    }
    previousBlock = true
  }

  if (registered.events.length > 0) {
    if (previousBlock) logger.blank()
    logger.line(styleText('dim', 'Events loaded:'))
    for (const event of registered.events) {
      logger.line(
        [
          style('★ Event', 'yellow'),
          style('>', 'gray'),
          style(event.name, 'yellow', 'underline'),
          style('✓', 'green'),
        ].join(' '),
      )
    }
  }
}
