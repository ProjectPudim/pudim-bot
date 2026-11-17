import type { Client, Message } from '@fluxerjs/core'
import { createContext, createNotFoundContext } from '../../context'
import { parseCommandArgs } from '../../utils/args'
import {
  concurrencyKey,
  tryAcquireConcurrency,
  type ConcurrencyScope,
} from '../../utils/concurrency'
import {
  cooldownKey,
  getDefaultCooldownAdapter,
  type CooldownAcquireResult,
  type CooldownAdapter,
  type CooldownScope,
} from '../../utils/cooldown'
import { logger, type CoreLogger } from '../../utils/logger'
import { CommandFailureError, isCommandFailureError } from './failures'
import {
  reportError,
  reportStop,
  runFailureHooks,
  runHook,
  type HookInfo,
} from './hooks'
import {
  middlewareList,
  MiddlewareStopError,
  runMiddlewares,
  type Middlewares,
} from './middleware'
import type { CommandRegistry } from './registry'
import { runRestrictions } from './restrictions'
import type {
  AnyCommand,
  AnyCommandContext,
  CommandContext,
  CommandErrorHandler,
  CommandHooks,
  CommandNotFoundErrorHandler,
  CommandNotFoundHandler,
  MiddlewareStopHandler,
  PrefixResolver,
} from './types'

export interface HandleCommandOptions {
  registry: CommandRegistry
  prefix: PrefixResolver
  ignoreBots?: boolean
  decorateContext?: (ctx: AnyCommandContext) => void | Promise<void>
  middlewares?: Middlewares
  onError?: CommandErrorHandler
  onMiddlewareStop?: MiddlewareStopHandler
  notFound?: CommandNotFoundHandler
  onNotFoundError?: CommandNotFoundErrorHandler
  ownerIds?: readonly string[]
  hooks?: CommandHooks
  logger?: CoreLogger
  cooldownAdapter?: CooldownAdapter
  cooldownPolicy?: 'block' | 'allow'
  botIdentity?: string
}

export type HandleCommandResult =
  'not-command' | 'not-found' | 'disabled' | 'stopped' | 'error' | 'executed'

async function resolvePrefix(
  resolver: PrefixResolver,
  message: Message,
  content: string,
): Promise<string | undefined> {
  const value =
    typeof resolver === 'function' ? await resolver(message) : resolver
  const prefixes = [
    ...new Set(typeof value === 'string' ? [value] : (value ?? [])),
  ]
    .filter((prefix) => prefix.length > 0)
    .sort((a, b) => b.length - a.length)

  return prefixes.find((candidate) => content.startsWith(candidate))
}

function normalizeCooldown(
  value: AnyCommand['cooldown'],
): { duration: number; scope?: CooldownScope } | undefined {
  if (value === undefined) return undefined
  return typeof value === 'number' ? { duration: value, scope: 'user' } : value
}

function normalizeConcurrency(
  value: AnyCommand['concurrency'],
): { limit: number; scope?: string } | undefined {
  if (value === undefined) return undefined
  return typeof value === 'number' ? { limit: value, scope: 'user' } : value
}

async function validateCommandArgs(
  command: AnyCommand,
  rawArgs: string,
  ctx: CommandContext,
): Promise<void> {
  if (!command.parseArgs && !command.argsSchema) return

  const parsed = parseCommandArgs(rawArgs)
  if (!parsed.ok) {
    throw new CommandFailureError({
      kind: 'arguments',
      code: 'PARSE_ERROR',
      parseError: parsed.error,
    })
  }

  ;(ctx as { parsedArgs?: unknown }).parsedArgs = parsed.value

  if (command.argsSchema) {
    const validation = await command.argsSchema['~standard'].validate({
      args: parsed.value.positionals,
      flags: parsed.value.flags,
    })
    if (validation.issues) {
      throw new CommandFailureError({
        kind: 'arguments',
        code: 'INVALID_ARGUMENTS',
        issues: validation.issues,
      })
    }
    ;(ctx as { validated?: unknown }).validated = validation.value
  }
}

async function acquireCommandCooldown(
  command: AnyCommand,
  message: Message,
  client: Client,
  options: HandleCommandOptions,
): Promise<void> {
  const config = normalizeCooldown(command.cooldown)
  if (!config) return

  const scope: CooldownScope = config.scope ?? 'user'
  const adapter = options.cooldownAdapter ?? getDefaultCooldownAdapter()
  const policy = options.cooldownPolicy ?? 'block'
  const botIdentity = options.botIdentity ?? client.user?.id ?? 'default'

  const key = cooldownKey(
    command.name,
    scope,
    {
      userId: message.author.id,
      guildId: message.guildId,
      channelId: message.channelId,
    },
    botIdentity,
  )

  let result: CooldownAcquireResult
  try {
    result = await adapter.acquire(key, config.duration)
  } catch {
    if (policy === 'allow') return
    throw new CommandFailureError({
      kind: 'cooldown',
      code: 'COOLDOWN_UNAVAILABLE',
      scope,
      retryAfter: 0,
    })
  }

  if (!result.acquired) {
    throw new CommandFailureError({
      kind: 'cooldown',
      code: 'COOLDOWN',
      scope,
      retryAfter: result.retryAfter,
    })
  }
}

export async function handleCommand(
  client: Client,
  message: Message,
  options: HandleCommandOptions,
): Promise<HandleCommandResult> {
  const log = options.logger ?? logger
  if ((options.ignoreBots ?? true) && message.author.bot) return 'not-command'
  if (!message.content) return 'not-command'

  let ctx: AnyCommandContext | undefined
  let result: HandleCommandResult = 'executed'
  let thrown: unknown
  const startedAt = Date.now()
  let releaseConcurrency: (() => void) | undefined

  try {
    const content = message.content.trimStart()
    const prefix = await resolvePrefix(options.prefix, message, content)
    if (!prefix) return 'not-command'

    const rest = content.slice(prefix.length).trimStart()
    const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(rest)
    if (!match?.[1]) return 'not-command'

    const invokedName = match[1]
    const rawArgs = match[2] ?? ''
    const args = rawArgs.trim() ? rawArgs.trim().split(/\s+/) : []
    const command = options.registry.get(invokedName)
    const input = {
      client,
      message,
      args,
      rawArgs,
      prefix,
      invokedName,
      registry: options.registry,
    }

    if (!command) {
      if (!options.notFound) return 'not-command'
      ctx = createNotFoundContext(input)
      await options.decorateContext?.(ctx)
      await options.notFound(ctx)
      return 'not-found'
    }

    const commandContext = createContext({ ...input, command })
    ctx = commandContext
    if (command.enabled === false) return 'disabled'
    await options.decorateContext?.(commandContext)

    const effectiveOwnerIds = [
      ...(options.ownerIds ?? []),
      ...(command.ownerIds ?? []),
    ]
    const concurrencyConfig = normalizeConcurrency(command.concurrency)

    let executed = false
    const executeCommand = async () => {
      executed = true

      await runRestrictions(command, commandContext, effectiveOwnerIds)
      await validateCommandArgs(command, rawArgs, commandContext)
      await acquireCommandCooldown(command, message, client, options)

      if (concurrencyConfig) {
        const scope = (concurrencyConfig.scope ?? 'user') as ConcurrencyScope
        const key = concurrencyKey(command.name, scope, {
          userId: message.author.id,
          guildId: message.guildId,
          channelId: message.channelId,
        })
        const release = tryAcquireConcurrency(key, concurrencyConfig.limit)
        if (!release) {
          throw new CommandFailureError({
            kind: 'concurrency',
            code: 'CONCURRENCY_LIMIT',
            scope,
          })
        }
        releaseConcurrency = release
      }

      await runHook(options.hooks?.before, commandContext)
      await runHook(command.hooks?.before, commandContext)

      await command.run(commandContext)

      const successInfo: HookInfo = {
        duration: Date.now() - startedAt,
        result: 'executed',
      }
      await runHook(options.hooks?.success, commandContext, successInfo)
      await runHook(command.hooks?.success, commandContext, successInfo)
    }

    const middlewares = [
      ...middlewareList(options.middlewares),
      ...middlewareList(command.middlewares),
    ]

    try {
      await runMiddlewares(middlewares, commandContext, executeCommand)
    } catch (error) {
      thrown = error

      if (error instanceof MiddlewareStopError) {
        result = 'stopped'
        const info: HookInfo = {
          duration: Date.now() - startedAt,
          result: 'stopped',
          error,
        }
        await runFailureHooks(
          options.hooks,
          command.hooks,
          commandContext,
          error,
          info,
        )
        await reportStop(commandContext, error, options)
        return 'stopped'
      }

      result = 'error'
      const info: HookInfo = {
        duration: Date.now() - startedAt,
        result: 'error',
        error,
      }
      await runFailureHooks(
        options.hooks,
        command.hooks,
        commandContext,
        error,
        info,
      )
      await reportError(commandContext, error, options)
      return 'error'
    }

    if (!executed) {
      result = 'stopped'
      return 'stopped'
    }

    result = 'executed'
    return 'executed'
  } catch (error) {
    thrown = error
    result = 'error'

    if (isCommandFailureError(error) && ctx?.command) {
      const info: HookInfo = {
        duration: Date.now() - startedAt,
        result: 'error',
        error,
      }
      await runFailureHooks(
        options.hooks,
        (ctx as CommandContext).command.hooks,
        ctx as CommandContext,
        error,
        info,
      )
    }

    await reportError(ctx, error, options)
    return 'error'
  } finally {
    releaseConcurrency?.()

    if (ctx?.command) {
      const info: HookInfo = {
        duration: Date.now() - startedAt,
        result,
        error: thrown,
      }
      try {
        await runHook(options.hooks?.finally, ctx as CommandContext, info)
        await runHook(
          (ctx as CommandContext).command.hooks?.finally,
          ctx as CommandContext,
          info,
        )
      } catch (hookError) {
        log.error('[commands] Finally hook failed', hookError)
      }
    }
  }
}
