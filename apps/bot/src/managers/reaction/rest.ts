import type { Client } from '@fluxerjs/core'
import type { Rest, RestUser } from '@pudim/shared/types'
import { emojiRoute } from '#bot/utils/emojis'
import { resolveReaction } from './registry'
import type { Binding, EditPayload } from './types'

const REACTION_PACE_MS = 320
const MAX_PAGINATION_PAGES = 10_000

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
export const uniqueKeys = <T>(list: T[]) => [...new Set(list)]

export const messageRoute = (channelId: string, messageId: string) =>
  `/channels/${channelId}/messages/${messageId}`

export const addOwnReaction = (
  rest: Rest,
  channelId: string,
  messageId: string,
  emoji: unknown,
) =>
  rest
    .put(
      `${messageRoute(channelId, messageId)}/reactions/${emojiRoute(emoji)}/@me`,
    )
    .then(() => true)
    .catch(() => false)

export const dropOwnReaction = (
  rest: Rest,
  channelId: string,
  messageId: string,
  emoji: unknown,
) =>
  rest
    .delete(
      `${messageRoute(channelId, messageId)}/reactions/${emojiRoute(emoji)}/@me`,
    )
    .then(() => true)
    .catch(() => false)

export const dropUserReaction = (
  rest: Rest,
  channelId: string,
  messageId: string,
  emoji: unknown,
  userId: string,
) =>
  rest
    .delete(
      `${messageRoute(channelId, messageId)}/reactions/${emojiRoute(emoji)}/${userId}`,
    )
    .then(() => true)
    .catch(() => false)

function toPlainJson(value: unknown): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    'toJSON' in value &&
    typeof value.toJSON === 'function'
  ) {
    return (value.toJSON as () => unknown).call(value)
  }
  return value
}

export function buildEditBody(payload: EditPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if ('content' in payload) body.content = payload.content ?? null
  if (payload.embeds) body.embeds = payload.embeds.map(toPlainJson)
  if (payload.allowedMentions) {
    body.allowed_mentions = {
      parse: payload.allowedMentions.parse,
      users: payload.allowedMentions.users,
      roles: payload.allowedMentions.roles,
      replied_user: payload.allowedMentions.repliedUser,
    }
  }
  return body
}

export async function addReactionsByKeys(
  rest: Rest,
  channelId: string,
  messageId: string,
  keys: string[],
): Promise<void> {
  for (const key of keys) {
    const entry = resolveReaction(key)
    if (!entry) continue
    await addOwnReaction(rest, channelId, messageId, entry.emoji)
    await sleep(REACTION_PACE_MS)
  }
}

export async function syncReactionKeys(
  rest: Rest,
  binding: Binding,
  next: string[],
): Promise<void> {
  const nextKeys = uniqueKeys(next)
  for (const key of nextKeys) {
    if (!resolveReaction(key)) {
      throw new Error(`ReactionManager: key "${key}" is not registered`)
    }
  }

  const idsOf = (keys: string[]) =>
    new Set(
      keys.flatMap((k) => {
        const entry = resolveReaction(k)
        return entry ? [entry.id] : []
      }),
    )

  const prevIds = idsOf(binding.keys)
  const nextIds = idsOf(nextKeys)
  const previous = binding.keys
  binding.keys = nextKeys

  for (const key of previous) {
    const entry = resolveReaction(key)
    if (entry && !nextIds.has(entry.id)) {
      await dropOwnReaction(
        rest,
        binding.channelId,
        binding.messageId,
        entry.emoji,
      )
      await sleep(REACTION_PACE_MS)
    }
  }

  await addReactionsByKeys(
    rest,
    binding.channelId,
    binding.messageId,
    nextKeys.filter((k) => !prevIds.has(resolveReaction(k)!.id)),
  )
}

export async function clearAllReactions(
  rest: Rest,
  channelId: string,
  messageId: string,
  keys: string[],
): Promise<void> {
  const cleared = await rest
    .delete(`${messageRoute(channelId, messageId)}/reactions`)
    .then(() => true)
    .catch(() => false)
  if (cleared) return

  for (const key of keys) {
    const entry = resolveReaction(key)
    if (entry) await dropOwnReaction(rest, channelId, messageId, entry.emoji)
  }
}

export async function fetchReactionUsers(
  client: Client,
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<RestUser[]> {
  const users = new Map<string, RestUser>()
  let after: string | null = null

  for (let page = 0; page < MAX_PAGINATION_PAGES; page++) {
    const response = (await client.rest.get(
      `${messageRoute(channelId, messageId)}/reactions/${emojiRoute(emoji)}?limit=100${after ? `&after=${after}` : ''}`,
    )) as
      | RestUser[]
      | {
          items?: RestUser[]
          users?: RestUser[]
          has_more?: boolean
          next_after?: string | null
        }

    const batch = Array.isArray(response)
      ? response
      : (response.items ?? response.users)

    if (!Array.isArray(batch) || batch.some((user) => !user.id)) {
      throw new Error('ReactionManager: incomplete reaction users response')
    }

    for (const user of batch) users.set(user.id!, user)

    const hasMore = Array.isArray(response)
      ? batch.length === 100
      : response.has_more === true
    if (!hasMore) return [...users.values()]

    const next = Array.isArray(response)
      ? batch.at(-1)?.id
      : response.next_after
    if (!next || next === after) {
      throw new Error('ReactionManager: invalid reaction users cursor')
    }
    after = next
  }

  throw new Error('ReactionManager: reaction users pagination limit exceeded')
}
