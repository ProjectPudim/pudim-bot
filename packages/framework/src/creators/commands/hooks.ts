import { logger } from '../../utils/logger'
import type { HandleCommandOptions, HandleCommandResult } from './handle'
import type { MiddlewareStopError } from './middleware'
import type {
  AnyCommandContext,
  CommandContext,
  CommandHooks,
  CommandNotFoundContext,
} from './types'

export interface HookInfo {
  duration: number
  result: HandleCommandResult
  error?: unknown
}

export async function runHook(
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

export async function runFailureHooks(
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

export async function reportStop(
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

export async function reportError(
  ctx: AnyCommandContext | undefined,
  error: unknown,
  options: HandleCommandOptions,
): Promise<void> {
  const log = options.logger ?? logger
  try {
    if (ctx?.command && options.onError) {
      await options.onError(ctx as CommandContext, error)
    } else if (ctx && !ctx.command && options.onNotFoundError) {
      await options.onNotFoundError(ctx as CommandNotFoundContext, error)
    } else {
      log.error(
        `[commands] Error in "${ctx?.invokedName ?? 'prefix resolution'}"`,
        error,
      )
    }
  } catch (handlerError) {
    log.error('[commands] Error handler failed', handlerError)
  }
}
