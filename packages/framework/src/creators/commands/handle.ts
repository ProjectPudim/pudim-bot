import {
  PermissionsBitField,
  type Client,
  type GuildChannel,
  type Message,
} from '@fluxerjs/core'
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
  middlewareList,
  MiddlewareStopError,
  runMiddlewares,
  type Middlewares,
} from './middleware'
import type { CommandRegistry } from './registry'
import type {
  AnyCommand,
  AnyCommandContext,
  CommandContext,
  CommandErrorHandler,
  CommandHooks,
  CommandNotFoundContext,
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

interface HookInfo {
  duration: number
  result: HandleCommandResult
  error?: unknown
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
    const value =
      typeof options.prefix === 'function'
        ? await options.prefix(message)
        : options.prefix
    const prefixes = [
      ...new Set(typeof value === 'string' ? [value] : (value ?? [])),
    ]
      .filter((prefix) => prefix.length > 0)
      .sort((a, b) => b.length - a.length)
    const content = message.content.trimStart()
    const prefix = prefixes.find((candidate) => content.startsWith(candidate))
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

    // Declarative restrictions
    await runRestrictions(command, commandContext, effectiveOwnerIds)

    // Optional parsing and validation
    if (command.parseArgs || command.argsSchema) {
      const parsed = parseCommandArgs(rawArgs)
      if (!parsed.ok) {
        throw new CommandFailureError({
          kind: 'arguments',
          code: 'PARSE_ERROR',
          parseError: parsed.error,
        })
      }
      ;(commandContext as { parsedArgs?: unknown }).parsedArgs = parsed.value
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
        ;(commandContext as { validated?: unknown }).validated =
          validation.value
      }
    }

    // Cooldown
    const cooldownConfig = normalizeCooldown(command.cooldown)
    if (cooldownConfig) {
      const scope = (cooldownConfig.scope ?? 'user') as CooldownScope
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
        result = await adapter.acquire(key, cooldownConfig.duration)
      } catch {
        if (policy === 'allow') {
          result = { acquired: true, token: 'allowed' }
        } else {
          throw new CommandFailureError({
            kind: 'cooldown',
            code: 'COOLDOWN_UNAVAILABLE',
            scope,
            retryAfter: 0,
          })
        }
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

    // Concurrency
    const concurrencyConfig = normalizeConcurrency(command.concurrency)
    if (concurrencyConfig) {
      const scope = (concurrencyConfig.scope ?? 'user') as ConcurrencyScope
      const limit = concurrencyConfig.limit
      const key = concurrencyKey(command.name, scope, {
        userId: message.author.id,
        guildId: message.guildId,
        channelId: message.channelId,
      })
      const release = tryAcquireConcurrency(key, limit)
      if (!release) {
        throw new CommandFailureError({
          kind: 'concurrency',
          code: 'CONCURRENCY_LIMIT',
          scope,
        })
      }
      releaseConcurrency = release
    }

    let executed = false
    const run = async () => {
      executed = true
      // before hooks (global then command)
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
      await runMiddlewares(middlewares, commandContext, run)
    } catch (error) {
      if (error instanceof MiddlewareStopError) {
        thrown = error
        result = 'stopped'
        // failure hooks
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
      thrown = error
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
    if (isCommandFailureError(error)) {
      result = 'error'
      const info: HookInfo = {
        duration: Date.now() - startedAt,
        result: 'error',
        error,
      }
      if (ctx?.command) {
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
    }
    result = 'error'
    await reportError(ctx, error, options)
    return 'error'
  } finally {
    releaseConcurrency?.()
    const info: HookInfo = {
      duration: Date.now() - startedAt,
      result: thrown ? result : result,
      error: thrown,
    }
    if (ctx) {
      try {
        if (ctx.command) {
          await runHook(options.hooks?.finally, ctx as CommandContext, info)
          await runHook(
            (ctx as CommandContext).command.hooks?.finally,
            ctx as CommandContext,
            info,
          )
        } else {
          // not-found context: no command hooks
        }
      } catch (hookError) {
        log.error('[commands] Finally hook failed', hookError)
      }
    }
  }
}

async function runRestrictions(
  command: AnyCommand,
  ctx: CommandContext,
  effectiveOwnerIds: readonly string[],
): Promise<void> {
  const contextMode = command.context ?? 'both'
  const actualContext: 'guild' | 'dm' = ctx.guildId ? 'guild' : 'dm'
  const allowed = contextMode === 'both' || contextMode === actualContext
  if (!allowed) {
    throw new CommandFailureError({
      kind: 'context',
      code: 'INVALID_CONTEXT',
      expected: contextMode,
      actual: actualContext,
    })
  }

  if (command.ownerOnly) {
    if (!effectiveOwnerIds.includes(ctx.author.id)) {
      throw new CommandFailureError({
        kind: 'owner',
        code: 'OWNER_ONLY',
      })
    }
  }

  // User permissions
  if (command.userPermissions) {
    const member = ctx.message.member ?? (await ctx.resolveMember())
    const channel = ctx.channel as unknown as GuildChannel | null
    let perms = member?.permissions
    if (member && channel && typeof member.permissionsIn === 'function') {
      try {
        perms = member.permissionsIn(channel)
      } catch {
        // fall back to guild permissions
      }
    }
    const required = command.userPermissions
    const missing =
      perms instanceof PermissionsBitField
        ? perms.missing(required)
        : new PermissionsBitField(0).missing(required)
    // If no member, all required are missing
    if (!member) {
      throw new CommandFailureError({
        kind: 'permissions',
        code: 'MISSING_PERMISSIONS',
        target: 'user',
        missing: [required],
      })
    }
    if (missing.length > 0) {
      throw new CommandFailureError({
        kind: 'permissions',
        code: 'MISSING_PERMISSIONS',
        target: 'user',
        missing,
      })
    }
  }

  // Bot permissions
  if (command.botPermissions) {
    const guild = ctx.guild
    const channel = ctx.channel as unknown as GuildChannel | null
    let botMember = guild?.members?.me ?? null
    if (!botMember && guild) {
      try {
        botMember = await guild.members.fetch(clientId(ctx.client))
      } catch (error) {
        throw new Error('[commands] Failed to resolve bot member.', {
          cause: error,
        })
      }
    }
    if (!botMember) {
      // DM or no guild: bot permissions cannot be checked; fail as missing
      throw new CommandFailureError({
        kind: 'permissions',
        code: 'MISSING_PERMISSIONS',
        target: 'bot',
        missing: [command.botPermissions],
      })
    }
    let perms = botMember.permissions
    if (channel && typeof botMember.permissionsIn === 'function') {
      try {
        perms = botMember.permissionsIn(channel)
      } catch {
        // fall back
      }
    }
    const missing = perms.missing(command.botPermissions)
    if (missing.length > 0) {
      throw new CommandFailureError({
        kind: 'permissions',
        code: 'MISSING_PERMISSIONS',
        target: 'bot',
        missing,
      })
    }
  }
}

function clientId(client: Client): string {
  return client.user?.id ?? ''
}

function normalizeCooldown(value: AnyCommand['cooldown']):
  | {
      duration: number
      scope?: CooldownScope
    }
  | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') return { duration: value, scope: 'user' }
  return value
}

function normalizeConcurrency(
  value: AnyCommand['concurrency'],
): { limit: number; scope?: string } | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') return { limit: value, scope: 'user' }
  return value
}

async function runHook(
  hook: unknown,
  ctx: CommandContext,
  info?: HookInfo,
): Promise<void> {
  const fn = hook as ((...args: unknown[]) => unknown) | undefined
  if (!fn) return
  try {
    await fn(ctx, info)
  } catch (error) {
    logger.error('[commands] Hook failed', error)
    throw error
  }
}

async function runFailureHooks(
  globalHooks: CommandHooks | undefined,
  commandHooks: CommandHooks | undefined,
  ctx: CommandContext,
  error: unknown,
  info: HookInfo,
): Promise<void> {
  try {
    await globalHooks?.failure?.(ctx, error, info)
  } catch (hookError) {
    logger.error('[commands] Failure hook failed', hookError)
  }
  try {
    await commandHooks?.failure?.(ctx, error, info)
  } catch (hookError) {
    logger.error('[commands] Failure hook failed', hookError)
  }
}

async function reportStop(
  ctx: CommandContext,
  stop: MiddlewareStopError,
  options: HandleCommandOptions,
): Promise<void> {
  const log = options.logger ?? logger
  try {
    await options.onMiddlewareStop?.(ctx, stop)
  } catch (handlerError) {
    log.error('[commands] Stop handler failed', handlerError)
  }
}

async function reportError(
  ctx: AnyCommandContext | undefined,
  error: unknown,
  options: HandleCommandOptions,
): Promise<void> {
  const log = options.logger ?? logger
  try {
    if (ctx?.command && options.onError)
      await options.onError(ctx as CommandContext, error)
    else if (ctx && !ctx.command && options.onNotFoundError)
      await options.onNotFoundError(ctx as CommandNotFoundContext, error)
    else
      log.error(
        `[commands] Error in "${ctx?.invokedName ?? 'prefix resolution'}"`,
        error,
      )
  } catch (handlerError) {
    log.error('[commands] Error handler failed', handlerError)
  }
}
