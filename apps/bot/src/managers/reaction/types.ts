import type { Client, MessageReactionPayload, User } from '@fluxerjs/core'
import type { Rest } from '@pudim/shared/types'

export type DefaultState = Record<string, unknown>

export interface Clicker {
  id: string
  user: User | null
}

export interface AllowedMentionsPayload {
  parse?: string[]
  users?: string[]
  roles?: string[]
  repliedUser?: boolean
}

export interface EditPayload {
  content?: string | null
  embeds?: unknown[]
  allowedMentions?: AllowedMentionsPayload
}

export type ReactionPayload = MessageReactionPayload

export interface Binding<S extends object = DefaultState> {
  messageId: string
  channelId: string
  guildId: string | null
  ownerId: string | null
  keys: string[]
  state: S
  permanent: boolean
  ttl: number
}

export interface ReactionContext<S extends object = DefaultState> {
  client: Client
  rest: Rest
  messageId: string
  channelId: string
  guildId: string | null
  ownerId: string | null
  clickerId: string
  key: string
  state: S
  live: unknown
  edit(payload: EditPayload): Promise<void>
  setKeys(keys: string[]): Promise<void>
  setState(patch: Partial<S>): void
  unbind(opts?: { clearReactions?: boolean }): Promise<void>
}

export type ReactionProcess = 'single' | 'multiple'

export interface ReactionDefinition<S extends object = DefaultState> {
  key: string
  emoji: string | ((key: string) => string)
  filter?: (
    ctx: ReactionContext<S>,
    clicker: Clicker,
  ) => boolean | Promise<boolean>
  run: (ctx: ReactionContext<S>) => unknown | Promise<unknown>
  remove?: (ctx: ReactionContext<S>) => unknown | Promise<unknown>
  ignoreOtherEmojis?: boolean
  maxQueued?: number
  consume?: boolean
  cooldownMs?: number
  concurrent?: boolean
  process?: ReactionProcess
}

export interface BindOptions<S extends object = DefaultState> {
  client: Client
  channelId: string
  guildId?: string | null
  ownerId?: string | null
  keys: string[]
  state?: S
  ttl?: number
  permanent?: boolean
  live?: unknown
  strictPersistence?: boolean
}
