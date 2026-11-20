import type { Rest, RestChannel } from '@pudim/shared/types'

const CHANNEL_MENTION = /^<#(\d+)>$/
const CHANNEL_SNOWFLAKE = /^\d{17,20}$/
const TEXT_CHANNEL_TYPES = new Set([0, 5])
const MESSAGE_LOOKUP_BATCH_SIZE = 5

export function parseChannelId(input?: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  return (
    trimmed.match(CHANNEL_MENTION)?.[1] ??
    (CHANNEL_SNOWFLAKE.test(trimmed) ? trimmed : null)
  )
}

export async function findMessageChannel(
  rest: Rest,
  guildId: string,
  messageId: string,
  preferredChannelId?: string,
): Promise<string | null> {
  const hasMessage = (channelId: string) =>
    rest
      .get(`/channels/${channelId}/messages/${messageId}`)
      .then(() => channelId)

  if (preferredChannelId) {
    const found = await hasMessage(preferredChannelId).catch(() => null)
    if (found) return found
  }

  const channels = (await rest
    .get(`/guilds/${guildId}/channels`)
    .catch(() => null)) as RestChannel[] | null
  if (!channels) return null

  const ids = channels
    .filter(
      (channel) =>
        TEXT_CHANNEL_TYPES.has(channel.type) &&
        channel.id !== preferredChannelId,
    )
    .map((channel) => channel.id)

  for (let i = 0; i < ids.length; i += MESSAGE_LOOKUP_BATCH_SIZE) {
    try {
      return await Promise.any(
        ids.slice(i, i + MESSAGE_LOOKUP_BATCH_SIZE).map(hasMessage),
      )
    } catch {
      // No channel in this batch contains the message
    }
  }

  return null
}
