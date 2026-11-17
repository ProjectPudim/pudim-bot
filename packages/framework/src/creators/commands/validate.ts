import { middlewareList } from './middleware'
import type { CommandOptions } from './types'

const NAME_PATTERN = /^[\p{L}\p{N}_-]{1,32}$/u
const VALID_COOLDOWN_SCOPES = new Set([
  'user',
  'user-guild',
  'guild',
  'channel',
  'global',
])
const VALID_CONCURRENCY_SCOPES = new Set(['user', 'guild', 'channel', 'global'])

export interface NormalizedIdentity {
  name: string
  aliases: string[]
}

export function validateCommandOptions<TExtra extends object>(
  options: CommandOptions<TExtra>,
): NormalizedIdentity {
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

  if (
    options.ownerIds !== undefined &&
    (!Array.isArray(options.ownerIds) ||
      options.ownerIds.some((id) => typeof id !== 'string'))
  ) {
    throw new Error(`[commands] ownerIds for "${name}" must be string array.`)
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

  if (options.cooldown !== undefined) {
    const cooldown = options.cooldown
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
    if (
      typeof cooldown !== 'number' &&
      cooldown?.scope !== undefined &&
      !VALID_COOLDOWN_SCOPES.has(cooldown.scope)
    ) {
      throw new Error(`[commands] Invalid cooldown scope for "${name}".`)
    }
  }

  if (options.concurrency !== undefined) {
    const concurrency = options.concurrency
    const limit =
      typeof concurrency === 'number' ? concurrency : concurrency?.limit
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
      throw new Error(
        `[commands] concurrency limit for "${name}" must be a positive integer.`,
      )
    }
    if (
      typeof concurrency !== 'number' &&
      concurrency?.scope !== undefined &&
      !VALID_CONCURRENCY_SCOPES.has(concurrency.scope)
    ) {
      throw new Error(`[commands] Invalid concurrency scope for "${name}".`)
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
    if (typeof rawAlias !== 'string') {
      throw new Error(`[commands] Aliases for "${name}" must be strings.`)
    }
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

  return { name, aliases }
}
