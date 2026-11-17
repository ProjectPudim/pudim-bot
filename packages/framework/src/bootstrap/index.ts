import {
  Client,
  createLogger,
  type ClientOptions,
  type LogLevel,
} from '@fluxerjs/core'
import { installClientCommands } from '../client-commands'
import { setEventRuntime } from '../creators/events/loader'
import {
  ensureCreatorsRuntime,
  type CreatorsRuntime,
} from '../creators/runtime'
import { setReloader, type ReloadResult } from '../reload'
import { MemoryCooldownAdapter } from '../utils/cooldown'
import { loadModules, type LoadedModule } from '../utils/loader'
import { logger, setLogger, style, type CoreLogger } from '../utils/logger'
import {
  activate,
  collectExports,
  deactivate,
  type RegisteredCounts,
} from './collect'
import { printLoadLogs } from './logs'
import { attachCommandPipeline } from './pipeline'
import {
  DEFAULT_MODULE_PATTERNS,
  type BootstrapOptions,
  type BootstrapResult,
  type CustomBootstrapOptions,
} from './types'

export { DEFAULT_MODULE_PATTERNS } from './types'
export type {
  BootstrapErrorHandler,
  BootstrapOptions,
  BootstrapResult,
  ClientFactory,
  CustomBootstrapOptions,
} from './types'

function resolveToken(options: BootstrapOptions): string {
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

  return token
}

function toSdkLogger(target: CoreLogger, level: LogLevel = 'warn') {
  return createLogger({
    level,
    sink: (sinkLevel, message, fields) => target[sinkLevel](message, fields),
  })
}

export function bootstrap<TClient extends Client>(
  options: CustomBootstrapOptions<TClient>,
): Promise<BootstrapResult<TClient>>
export function bootstrap(
  options: BootstrapOptions,
): Promise<BootstrapResult<Client>>
export async function bootstrap(
  options: BootstrapOptions,
): Promise<BootstrapResult<Client>> {
  const token = resolveToken(options)

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

    if (showLogs) printLoadLogs(runtime, registered)

    await client.login(token)

    if (showLogs) {
      logger.blank()
      logger.line(
        `${style(client.user ? client.user.username : 'Bot', 'green', 'underline')} ${style('application is ready!', 'green')}`,
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
