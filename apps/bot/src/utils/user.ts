import { parseUserMention, type Client } from '@fluxerjs/core'
import type { RestMember } from '@pudim/shared/types'

export function parseTargetId(raw?: string): string | null {
  if (!raw) return null

  const id = parseUserMention(raw) ?? raw.replace(/\D/g, '')
  return /^\d{17,20}$/.test(id) ? id : null
}

export async function fetchMember(
  client: Pick<Client, 'rest'>,
  guildId: string,
  userId: string,
): Promise<RestMember | null> {
  return client.rest
    .get(`/guilds/${guildId}/members/${userId}`)
    .catch(() => null) as Promise<RestMember | null>
}
