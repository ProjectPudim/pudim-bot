import type { EmptyObject } from '../../types'
import { middlewareList } from './middleware'
import type { Command, CommandContext, CommandOptions } from './types'

const NAME_PATTERN = /^[\p{L}\p{N}_-]{1,32}$/u

export function createCommand<const TOptions extends object>(
  options: { [K in keyof TOptions]: TOptions[K] } & Omit<
    CommandOptions,
    'run'
  > & {
      run?: (ctx: CommandContext<NoInfer<TOptions>>) => void | Promise<void>
    },
): Command<TOptions>
export function createCommand<const TExtra extends object = EmptyObject>(
  options: CommandOptions<TExtra>,
): Command<TExtra>
export function createCommand<const TExtra extends object = EmptyObject>(
  options: CommandOptions<TExtra>,
): Command<TExtra> {
  if (!options || typeof options.name !== 'string') {
    throw new Error('[commands] A command requires a string name.')
  }
  const name = options.name.trim().toLowerCase()

  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      `[commands] Invalid command name: "${options.name}". ` +
        `Use 1-32 Unicode letters, numbers, "_" or "-".`,
    )
  }

  if (typeof options.description !== 'string' || !options.description.trim()) {
    throw new Error(
      `[commands] Command "${name}" requires a non-empty description.`,
    )
  }
  if (options.run !== undefined && typeof options.run !== 'function') {
    throw new Error(`[commands] Executor for "${name}" must be a function.`)
  }
  for (const key of ['enabled', 'hidden'] as const) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw new Error(`[commands] ${key} for "${name}" must be boolean.`)
    }
  }

  middlewareList(options.middlewares)

  const aliases: string[] = []
  if (options.aliases !== undefined && !Array.isArray(options.aliases)) {
    throw new Error(
      `[commands] Aliases for "${name}" must be an array of strings.`,
    )
  }
  for (const rawAlias of options.aliases ?? []) {
    if (typeof rawAlias !== 'string')
      throw new Error(`[commands] Aliases for "${name}" must be strings.`)
    const alias = rawAlias.trim().toLowerCase()

    if (!NAME_PATTERN.test(alias)) {
      throw new Error(
        `[commands] Invalid alias "${rawAlias}" (command "${name}").`,
      )
    }
    if (alias === name) {
      throw new Error(
        `[commands] Alias "${alias}" matches the command name "${name}".`,
      )
    }
    if (aliases.includes(alias)) {
      throw new Error(
        `[commands] Duplicate alias "${alias}" in command "${name}".`,
      )
    }

    aliases.push(alias)
  }

  return {
    ...options,
    name,
    aliases,
    hidden: options.hidden ?? false,
    enabled: options.enabled ?? true,
    run:
      options.run ??
      (() => {
        throw new Error(
          `[commands] Command "${name}" has no executor. Provide run() or disable it with enabled: false.`,
        )
      }),
    __isCommand: true,
  } as Command<TExtra>
}
