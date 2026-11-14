import type { CommandContext } from './types'

/** Thrown by `middle.stop()`; the pipeline forwards it to `onMiddlewareStop` */
export class MiddlewareStopError extends Error {
  readonly middleware: string
  readonly reason: string | undefined

  constructor(middleware: string, reason?: string) {
    super(reason ?? `Middleware "${middleware}" stopped the command.`)
    this.name = 'MiddlewareStopError'
    this.middleware = middleware
    this.reason = reason
  }
}

export interface MiddlewareHandle {
  readonly context: CommandContext
  /** Call at most once */
  next(): Promise<void>
  /** Skips the command and reports to `onMiddlewareStop` */
  stop(reason?: string): never
}

export interface MiddlewareOptions {
  name: string
  run: (middle: MiddlewareHandle) => void | Promise<void>
}

export interface Middleware {
  readonly name: string
  readonly run: MiddlewareOptions['run']
  readonly __isMiddleware: true
}

export type Middlewares = Middleware | readonly Middleware[]

export function createMiddleware(options: MiddlewareOptions): Middleware {
  if (
    !options ||
    typeof options.name !== 'string' ||
    !options.name.trim() ||
    typeof options.run !== 'function'
  ) {
    throw new Error(
      '[middlewares] A middleware requires a non-empty name and a run() function.',
    )
  }
  return {
    name: options.name.trim(),
    run: options.run,
    __isMiddleware: true,
  }
}

export function isMiddleware(value: unknown): value is Middleware {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__isMiddleware' in value &&
    value.__isMiddleware === true &&
    'name' in value &&
    typeof value.name === 'string' &&
    'run' in value &&
    typeof value.run === 'function'
  )
}

export function middlewareList(
  middlewares?: Middlewares,
): readonly Middleware[] {
  if (!middlewares) return []
  const list = Array.isArray(middlewares) ? middlewares : [middlewares]
  if (!list.every(isMiddleware)) {
    throw new Error(
      '[middlewares] Expected middlewares created with createMiddleware().',
    )
  }
  return list
}

export async function runMiddlewares(
  middlewares: readonly Middleware[],
  context: CommandContext,
  final: () => Promise<void>,
): Promise<void> {
  const dispatch = async (index: number): Promise<void> => {
    const middleware = middlewares[index]
    if (!middleware) return final()

    let called = false
    let finished = false
    let downstream:
      Promise<{ ok: true } | { ok: false; error: unknown }> | undefined
    let failure: { error: unknown } | undefined

    const handle: MiddlewareHandle = {
      context,
      next() {
        if (called || finished) {
          throw new Error(
            `[middlewares] next() in "${middleware.name}" must be called at most once and before the middleware returns.`,
          )
        }
        called = true
        const pending = dispatch(index + 1)
        // Observe immediately, including when a middleware forgets to await next()
        downstream = pending.then(
          () => ({ ok: true as const }),
          (error: unknown) => ({ ok: false as const, error }),
        )
        return pending
      },
      stop(reason) {
        throw new MiddlewareStopError(middleware.name, reason)
      },
    }

    try {
      await middleware.run(handle)
    } catch (error) {
      failure = { error }
    } finally {
      finished = true
    }

    const result = await downstream
    if (failure) throw failure.error
    if (result && !result.ok) throw result.error
  }

  await dispatch(0)
}
