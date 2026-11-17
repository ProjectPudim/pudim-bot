import { parseUserMention, type Client, type User } from '@fluxerjs/core'
import type { RestMember } from '@pudim/shared/types'

const USER_SNOWFLAKE = /^\d{17,20}$/
const CHANNEL_MENTION = /^<#(\d+)>$/
const CHANNEL_SNOWFLAKE = /^\d{17,20}$/
const ROLE_MENTION = /^<@&(\d+)>$/
const ROLE_SNOWFLAKE = /^\d{15,25}$/
const INVITE_CODE_PATTERN = /^[a-zA-Z0-9-]{2,}$/

const RECOGNIZED_INVITE_HOSTS = new Set([
  'fluxer.gg',
  'www.fluxer.gg',
  'fluxer.com',
  'www.fluxer.com',
  'web.fluxer.app',
])

export function parseUserId(raw?: string): string | null {
  if (!raw) return null
  const id = parseUserMention(raw) ?? raw.replace(/\D/g, '')
  return USER_SNOWFLAKE.test(id) ? id : null
}

export { parseUserId as parseTargetId }

export function parseChannelId(input?: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  return (
    trimmed.match(CHANNEL_MENTION)?.[1] ??
    (CHANNEL_SNOWFLAKE.test(trimmed) ? trimmed : null)
  )
}

export function parseRoleId(input?: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  return (
    trimmed.match(ROLE_MENTION)?.[1] ??
    (ROLE_SNOWFLAKE.test(trimmed) ? trimmed : null)
  )
}

export function extractInviteCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (INVITE_CODE_PATTERN.test(trimmed)) {
    return trimmed
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    )
    if (!RECOGNIZED_INVITE_HOSTS.has(url.hostname.toLowerCase())) {
      return null
    }

    const segments = url.pathname.split('/').filter(Boolean)

    if (segments.length === 1) {
      const code = segments[0]
      return code && INVITE_CODE_PATTERN.test(code) ? code : null
    }

    if (segments.length === 2) {
      const [prefix, code] = segments
      if (
        prefix?.toLowerCase() === 'invite' &&
        code &&
        INVITE_CODE_PATTERN.test(code)
      ) {
        return code
      }
    }

    return null
  } catch {
    return null
  }
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

export async function resolveUser(
  client: Client,
  targetId: string,
  author?: User,
): Promise<User | null> {
  if (author && targetId === author.id) return author
  return client.users.fetch(targetId).catch(() => null)
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    timer.unref?.()

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
    )
  })
}
