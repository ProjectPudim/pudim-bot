import { createHash } from 'node:crypto'
import {
  PermissionFlags,
  User,
  type Client,
  type PermissionString,
} from '@fluxerjs/core'
import type { RestChannel, RestMember } from '@pudim/shared/types'
import { emojiIdentity } from '#bot/utils/emojis'
import {
  giveawayOperation,
  httpStatus,
  logGiveawayFailure,
} from './diagnostics'

export { httpStatus } from './diagnostics'

export type GiveawayErrorCode =
  | 'duration'
  | 'minDuration'
  | 'winners'
  | 'channel'
  | 'host'
  | 'emoji'
  | 'roles'
  | 'server'
  | 'invitePermission'
  | 'notFound'
  | 'active'
  | 'ended'
  | 'busy'
  | 'pending'
  | 'tooLong'
  | 'extra'
  | 'creationPending'
  | 'invitePending'
  | 'apiRejected'

export class GiveawayError extends Error {
  constructor(
    readonly code: GiveawayErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options)
  }
}

export const isSnowflake = (input: string) => /^\d{17,20}$/.test(input)

export function parseMessageUrl(input: string): {
  guildId: string
  channelId: string
  messageId: string
} | null {
  if (isSnowflake(input)) return null
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const host = url.hostname.toLowerCase()
    if (
      ![
        'web.fluxer.app',
        'fluxer.app',
        'fluxer.com',
        'fluxer.gg',
        'www.fluxer.com',
        'www.fluxer.gg',
      ].includes(host)
    )
      return null
    const parts = url.pathname.split('/').filter(Boolean)
    // channels/{guild}/{channel}/{message}
    const idx = parts.indexOf('channels')
    if (idx === -1 || parts.length < idx + 4) return null
    const guildId = parts[idx + 1]!
    const channelId = parts[idx + 2]!
    const messageId = parts[idx + 3]!
    if (
      !isSnowflake(guildId) ||
      !isSnowflake(channelId) ||
      !isSnowflake(messageId)
    )
      return null
    return { guildId, channelId, messageId }
  } catch {
    return null
  }
}
export const messageLink = (
  guildId: string,
  channelId: string,
  messageId: string,
) => `https://web.fluxer.app/channels/${guildId}/${channelId}/${messageId}`

export function giveawayNonce(
  id: string,
  kind: 'create' | 'result',
  revision = 0,
) {
  return createHash('sha256')
    .update(`${kind}:${id}:${revision}`)
    .digest('hex')
    .slice(0, 32)
}

export async function freshMember(
  client: Client,
  guildId: string,
  userId: string,
  operationId = `${guildId}:${userId}`,
): Promise<RestMember | null> {
  const path = `/guilds/${guildId}/members/${userId}`
  try {
    const member = (await client.rest.get(path)) as RestMember
    if (member?.user?.id !== userId || !Array.isArray(member.roles))
      throw new GiveawayError('pending')
    return member
  } catch (error) {
    if (
      httpStatus(error) === 404 &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'UNKNOWN_MEMBER'
    )
      return null
    logGiveawayFailure(error, {
      operationId,
      operation: 'member.fetch',
      method: 'GET',
      path,
    })
    throw new GiveawayError('pending', { cause: error })
  }
}

export function accountCreatedAt(
  client: Client,
  user: NonNullable<RestMember['user']>,
): number | null {
  if (!user.id || !isSnowflake(user.id)) return null
  const timestamp = new User(client, {
    ...user,
    id: user.id,
    global_name: user.global_name ?? null,
    avatar_color: user.avatar_color ?? null,
    flags: user.flags ?? 0,
  }).createdTimestamp
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= Date.now()
    ? timestamp
    : null
}

type PermissionRole = { id: string; permissions: string }

export async function channelPermissions(
  client: Client,
  guildId: string,
  channelId: string,
  required: PermissionString[],
  operationId = `${guildId}:${channelId}`,
) {
  const botId = client.user?.id
  if (!botId) throw new GiveawayError('pending')
  const [channel, guild, roles, member] = await Promise.all([
    giveawayOperation(
      {
        operationId,
        operation: 'permissions.channel',
        method: 'GET',
        path: `/channels/${channelId}`,
      },
      () => client.rest.get(`/channels/${channelId}`),
    ) as Promise<RestChannel>,
    giveawayOperation(
      {
        operationId,
        operation: 'permissions.guild',
        method: 'GET',
        path: `/guilds/${guildId}`,
      },
      () => client.rest.get(`/guilds/${guildId}`),
    ) as Promise<{ owner_id: string }>,
    giveawayOperation(
      {
        operationId,
        operation: 'permissions.roles',
        method: 'GET',
        path: `/guilds/${guildId}/roles`,
      },
      () => client.rest.get(`/guilds/${guildId}/roles`),
    ) as Promise<PermissionRole[]>,
    freshMember(client, guildId, botId, operationId),
  ])
  if (
    !member ||
    channel.guild_id !== guildId ||
    ![0, 5].includes(channel.type ?? -1)
  )
    return false
  if (guild.owner_id === botId) return true
  let bits = 0n
  for (const role of roles)
    if (role.id === guildId || member.roles.includes(role.id))
      bits |= BigInt(role.permissions)
  if (bits & PermissionFlags.Administrator) return true
  const overwrites = channel.permission_overwrites ?? []
  const everyone = overwrites.find((overwrite) => overwrite.id === guildId)
  if (everyone)
    bits = (bits & ~BigInt(everyone.deny ?? 0)) | BigInt(everyone.allow ?? 0)
  let deny = 0n
  let allow = 0n
  for (const overwrite of overwrites)
    if (overwrite.type === 0 && member.roles.includes(overwrite.id)) {
      deny |= BigInt(overwrite.deny ?? 0)
      allow |= BigInt(overwrite.allow ?? 0)
    }
  bits = (bits & ~deny) | allow
  const own = overwrites.find(
    (overwrite) => overwrite.id === botId && overwrite.type === 1,
  )
  if (own) bits = (bits & ~BigInt(own.deny ?? 0)) | BigInt(own.allow ?? 0)
  return required.every(
    (permission) => (bits & PermissionFlags[permission]) !== 0n,
  )
}

export async function validateGiveawayEmoji(
  client: Client,
  guildId: string,
  channelId: string,
  emoji: string,
  operationId = `${guildId}:${channelId}`,
) {
  const id = emojiIdentity(emoji)
  if (!/^\d+$/.test(id)) return emoji
  if (!isSnowflake(id)) throw new GiveawayError('emoji')
  try {
    const metadata = await giveawayOperation(
      {
        operationId,
        operation: 'emoji.metadata',
        method: 'GET',
        path: `/emojis/${id}/metadata`,
      },
      () => client.fetchEmojiMetadata(id),
    )
    if (metadata.id !== id || !metadata.name) throw new GiveawayError('emoji')
    if (
      metadata.guild_id !== guildId &&
      !(await channelPermissions(
        client,
        guildId,
        channelId,
        ['UseExternalEmojis'],
        operationId,
      ))
    )
      throw new GiveawayError('emoji')
    return `<${metadata.animated ? 'a' : ''}:${metadata.name}:${id}>`
  } catch (error) {
    throw new GiveawayError('emoji', { cause: error })
  }
}
