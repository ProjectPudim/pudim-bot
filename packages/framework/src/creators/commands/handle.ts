import type { Client, Message } from '@fluxerjs/core'
import { createContext, createNotFoundContext } from '../../context'
import { logger } from '../../utils/logger'
import {
  middlewareList,
  MiddlewareStopError,
  runMiddlewares,
  type Middlewares,
} from './middleware'
import type { CommandRegistry } from './registry'
import type {
  AnyCommandContext,
  CommandContext,
  CommandErrorHandler,
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
}

export type HandleCommandResult =
  'not-command' | 'not-found' | 'disabled' | 'stopped' | 'error' | 'executed'

export async function handleCommand(
  client: Client,
  message: Message,
  options: HandleCommandOptions,
): Promise<HandleCommandResult> {
  if ((options.ignoreBots ?? true) && message.author.bot) return 'not-command'
  if (!message.content) return 'not-command'

  let ctx: AnyCommandContext | undefined
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

    let executed = false
    const run = async () => {
      executed = true
      await command.run(commandContext)
    }

    await runMiddlewares(
      [
        ...middlewareList(options.middlewares),
        ...middlewareList(command.middlewares),
      ],
      commandContext,
      run,
    )
    return executed ? 'executed' : 'stopped'
  } catch (error) {
    if (error instanceof MiddlewareStopError && ctx?.command) {
      await reportStop(ctx, error, options)
      return 'stopped'
    }
    await reportError(ctx, error, options)
    return 'error'
  }
}

async function reportStop(
  ctx: CommandContext,
  stop: MiddlewareStopError,
  options: HandleCommandOptions,
): Promise<void> {
  try {
    await options.onMiddlewareStop?.(ctx, stop)
  } catch (handlerError) {
    logger.error('[commands] Stop handler failed', handlerError)
  }
}

async function reportError(
  ctx: AnyCommandContext | undefined,
  error: unknown,
  options: HandleCommandOptions,
): Promise<void> {
  try {
    if (ctx?.command && options.onError) await options.onError(ctx, error)
    else if (ctx && !ctx.command && options.onNotFoundError)
      await options.onNotFoundError(ctx, error)
    else
      logger.error(
        `[commands] Error in "${ctx?.invokedName ?? 'prefix resolution'}"`,
        error,
      )
  } catch (handlerError) {
    logger.error('[commands] Error handler failed', handlerError)
  }
}
