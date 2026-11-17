import type { PermissionString } from '@fluxerjs/core'
import type { StandardSchemaV1 } from '../../utils/standard-schema'

export type CommandFailureKind =
  | 'context'
  | 'owner'
  | 'permissions'
  | 'arguments'
  | 'cooldown'
  | 'concurrency'
  | 'stopped'

export interface ContextFailure {
  readonly kind: 'context'
  readonly code: 'INVALID_CONTEXT'
  readonly expected: 'guild' | 'dm' | 'both'
  readonly actual: 'guild' | 'dm'
}

export interface OwnerFailure {
  readonly kind: 'owner'
  readonly code: 'OWNER_ONLY'
}

export interface PermissionsFailure {
  readonly kind: 'permissions'
  readonly code: 'MISSING_PERMISSIONS'
  readonly target: 'user' | 'bot'
  readonly missing: readonly PermissionString[]
}

export interface ArgumentsFailure {
  readonly kind: 'arguments'
  readonly code: 'INVALID_ARGUMENTS' | 'PARSE_ERROR'
  readonly issues?: readonly StandardSchemaV1.Issue[]
  readonly parseError?: string
}

export interface CooldownFailure {
  readonly kind: 'cooldown'
  readonly code: 'COOLDOWN' | 'COOLDOWN_UNAVAILABLE'
  readonly scope: string
  readonly retryAfter: number
}

export interface ConcurrencyFailure {
  readonly kind: 'concurrency'
  readonly code: 'CONCURRENCY_LIMIT'
  readonly scope: string
}

export interface StoppedFailure {
  readonly kind: 'stopped'
  readonly code: 'MIDDLEWARE_STOPPED'
  readonly middleware: string
  readonly reason?: string
}

export type CommandFailure =
  | ContextFailure
  | OwnerFailure
  | PermissionsFailure
  | ArgumentsFailure
  | CooldownFailure
  | ConcurrencyFailure
  | StoppedFailure

export class CommandFailureError extends Error {
  readonly failure: CommandFailure

  constructor(failure: CommandFailure) {
    super(failure.code)
    this.name = 'CommandFailureError'
    this.failure = failure
  }
}

export function isCommandFailureError(
  error: unknown,
): error is CommandFailureError {
  return error instanceof CommandFailureError
}
