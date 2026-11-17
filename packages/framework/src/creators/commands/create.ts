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
  for (const key of ['enabled', 'hidden', 'ownerOnly', 'parseArgs'] as const) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw new Error(`[commands] ${key} for "${name}" must be boolean.`)
    }
  }
  if (
    options.context !== undefined &&
    options.context !== 'guild' &&
    options.context !== 'dm' &&
    options.context !== 'both'
  ) {
    throw new Error(
      `[commands] context for "${name}" must be "guild", "dm" or "both".`,
    )
  }
  if (options.ownerIds !== undefined) {
    if (
      !Array.isArray(options.ownerIds) ||
      options.ownerIds.some((id) => typeof id !== 'string')
    ) {
      throw new Error(`[commands] ownerIds for "${name}" must be string array.`)
    }
  }
  if (
    options.userPermissions !== undefined &&
    typeof options.userPermissions !== 'string' &&
    typeof options.userPermissions !== 'number' &&
    typeof options.userPermissions !== 'bigint' &&
    !Array.isArray(options.userPermissions) &&
    !(options.userPermissions as { bitfield?: unknown } | null)?.bitfield
  ) {
    // PermissionResolvable is broad; accept any non-null value here.
  }
  if (options.hooks !== undefined) {
    if (typeof options.hooks !== 'object' || options.hooks === null) {
      throw new Error(`[commands] hooks for "${name}" must be an object.`)
    }
    for (const key of ['before', 'success', 'failure', 'finally'] as const) {
      const value = (options.hooks as Record<string, unknown>)[key]
      if (value !== undefined && typeof value !== 'function') {
        throw new Error(
          `[commands] hooks.${key} for "${name}" must be a function.`,
        )
      }
    }
  }

  const cooldown = options.cooldown
  if (cooldown !== undefined) {
    const duration =
      typeof cooldown === 'number' ? cooldown : cooldown?.duration
    if (
      typeof duration !== 'number' ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      throw new Error(
        `[commands] cooldown duration for "${name}" must be a positive number (ms).`,
      )
    }
    if (typeof cooldown !== 'number') {
      const scope = cooldown?.scope
      if (
        scope !== undefined &&
        scope !== 'user' &&
        scope !== 'user-guild' &&
        scope !== 'guild' &&
        scope !== 'channel' &&
        scope !== 'global'
      ) {
        throw new Error(`[commands] Invalid cooldown scope for "${name}".`)
      }
    }
  }

  const concurrency = options.concurrency
  if (concurrency !== undefined) {
    const limit =
      typeof concurrency === 'number' ? concurrency : concurrency?.limit
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
      throw new Error(
        `[commands] concurrency limit for "${name}" must be a positive integer.`,
      )
    }
    if (typeof concurrency !== 'number') {
      const scope = concurrency?.scope
      if (
        scope !== undefined &&
        scope !== 'user' &&
        scope !== 'guild' &&
        scope !== 'channel' &&
        scope !== 'global'
      ) {
        throw new Error(`[commands] Invalid concurrency scope for "${name}".`)
      }
    }
  }

  if (options.argsSchema !== undefined) {
    const standard = (
      options.argsSchema as { ['~standard']?: { validate?: unknown } }
    )?.['~standard']
    if (typeof standard?.validate !== 'function') {
      throw new Error(
        `[commands] argsSchema for "${name}" must be a Standard Schema.`,
      )
    }
  }

  if (options.enabled !== false && typeof options.run !== 'function') {
    throw new Error(
      `[commands] Enabled command "${name}" requires a run() function.`,
    )
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
