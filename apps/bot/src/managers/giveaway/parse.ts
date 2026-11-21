import { Invite, type Client } from '@fluxerjs/core'
import { MAX_GIVEAWAY_WINNERS } from '@pudim/database'
import { emojis } from '#bot/config'
import type { TranslateFunction } from '#bot/i18n'
import { parseChannelId, parseEmbed, parseRoleId } from '#bot/utils'
import { parseEmoji } from '#bot/utils/emojis'
import { collectFlags } from '#bot/utils/flags'
import { parseDuration } from '#bot/utils/time'
import { apiCode, giveawayOperation, logGiveawayFailure } from './diagnostics'
import {
  channelPermissions,
  freshMember,
  GiveawayError,
  httpStatus,
  isSnowflake,
} from './helpers'
import { GIVEAWAY_FLAGS } from './usage'

type FlagName = keyof typeof GIVEAWAY_FLAGS

export function parseCreate(args: string[], t: TranslateFunction) {
  const flags = collectFlags(
    args,
    (name) =>
      Object.hasOwn(GIVEAWAY_FLAGS, name) ? (name as FlagName) : undefined,
    { allowText: true },
  )
  if (flags.error)
    return {
      error: t(
        `errors.embed.${flags.code}`,
        flags.params.map((param) => `\`${param}\``).join(', '),
      ),
    } as const
  const empty = [...flags.raw]
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (empty.length)
    return { error: t('errors.embed.emptyArgument', empty.join(', ')) } as const

  const positional = [...flags.text]
  const first = positional[0]
  const hasChannel = !!first && (first.startsWith('<#') || isSnowflake(first))
  const channelInput = hasChannel ? positional.shift() : undefined
  if (channelInput && !parseChannelId(channelInput))
    throw new GiveawayError('channel')
  const [duration, count, ...prizeParts] = positional

  // Validate supplied arguments even when later positional arguments are missing.
  const durationResult = duration
    ? parseDuration(duration, { min: 60_000 })
    : null
  if (durationResult && !durationResult.ok) {
    const reason = (durationResult as { reason?: string }).reason
    if (reason === 'min') throw new GiveawayError('minDuration')
    throw new GiveawayError('duration')
  }
  if (
    count &&
    (!/^\d+$/.test(count) ||
      !Number.isSafeInteger(Number(count)) ||
      Number(count) < 1 ||
      Number(count) > MAX_GIVEAWAY_WINNERS)
  )
    throw new GiveawayError('winners')
  const visualNames = [
    'title',
    'description',
    'color',
    'image',
    'thumbnail',
  ] as const
  const visualArgs = visualNames.flatMap((key) =>
    flags.raw.has(key) ? [`--${key}`, flags.raw.get(key)!] : [],
  )
  const visual = visualArgs.length
    ? parseEmbed(visualArgs, [], { partial: true })
    : null
  if (visual?.error)
    return {
      error: t(`errors.embed.${visual.code}`, visual.params.join(', ')),
    } as const
  const emoji = parseEmoji(flags.raw.get('emoji') ?? emojis.giveaway)
  if (
    !emoji ||
    ([
      ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
        emoji.raw,
      ),
    ].length !== 1 &&
      !/^\w+:\d+$/.test(emoji.raw))
  )
    return { error: t('common.invalidEmoji') } as const

  const durationFlag = (key: 'requiredJoinedAt' | 'requiredAccountAge') => {
    const value = flags.raw.get(key)
    if (!value) return null
    const parsed = parseDuration(value, { min: 1000 })
    if (!parsed.ok) throw new GiveawayError('duration')
    return parsed.ms
  }
  const host = flags.raw.get('host')
  const hostId = host ? /^(?:<@!?(\d{17,20})>|(\d{17,20}))$/.exec(host) : null
  if (host && !hostId) throw new GiveawayError('host')
  const roleParts =
    flags.raw
      .get('requiredRoles')
      ?.split(',')
      .map((value) => value.trim()) ?? []
  const roles = roleParts.map(parseRoleId)
  if (roles.some((id) => !id) || roles.length > 20)
    throw new GiveawayError('roles')
  const prize = prizeParts.join(' ')
  if (prize.length > 200) throw new GiveawayError('tooLong')
  const requiredJoinedDuration = durationFlag('requiredJoinedAt')
  const requiredAccountAgeDuration = durationFlag('requiredAccountAge')
  const requiredServer = flags.raw.get('requiredServer') ?? null
  if (
    requiredServer &&
    !isSnowflake(requiredServer) &&
    !inviteCode(requiredServer)
  )
    throw new GiveawayError('server')
  if (!duration || !count || !prizeParts.length)
    return { missing: true } as const
  if (!durationResult || !durationResult.ok) {
    const reason = (durationResult as { reason?: string } | null)?.reason
    if (reason === 'min') throw new GiveawayError('minDuration')
    throw new GiveawayError('duration')
  }

  return {
    data: {
      channelId: channelInput ? parseChannelId(channelInput)! : null,
      duration: durationResult.ms,
      winnerCount: Number(count),
      prize,
      title: flags.raw.get('title') ?? `🎁 ${prize}`,
      description: flags.raw.get('description') ?? null,
      color:
        visual && !visual.error && visual.embed.color !== undefined
          ? `#${visual.embed.color.toString(16).padStart(6, '0')}`
          : null,
      image: flags.raw.get('image') ?? null,
      thumbnail: flags.raw.get('thumbnail') ?? null,
      emoji: emoji.display,
      hostId: hostId?.[1] ?? hostId?.[2] ?? null,
      requiredRoleIds: [...new Set(roles as string[])],
      requiredJoinedDuration,
      requiredAccountAgeDuration,
      requiredServer,
    },
  } as const
}

export type CreateOptions = Extract<
  ReturnType<typeof parseCreate>,
  { data: object }
>['data']

export function inviteCode(input: string): string | null {
  try {
    const url = new URL(input)
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null
    const host = url.hostname.toLowerCase()
    const pattern = ['fluxer.gg', 'www.fluxer.gg'].includes(host)
      ? /^\/([\w-]+)\/?$/
      : ['fluxer.com', 'www.fluxer.com'].includes(host)
        ? /^\/invite\/([\w-]+)\/?$/
        : null
    return pattern?.exec(url.pathname)?.[1] ?? null
  } catch {
    return null
  }
}

export async function resolveRequiredServer(
  client: Client,
  input: string | null,
  hooks: {
    operationId?: string
    beforeCreate?: (channelId: string) => Promise<void>
    onRejected?: () => Promise<void>
    onCreated?: (invite: {
      code: string
      requiredServerId: string
      requiredServerInvite: string
      verified: boolean
    }) => Promise<void>
  } = {},
) {
  if (!input) return { requiredServerId: null, requiredServerInvite: null }
  const byId = isSnowflake(input)
  const code = byId ? null : inviteCode(input)
  if (!byId && !code) throw new GiveawayError('server')
  const operationId = hooks.operationId ?? 'required-server'
  let ownedCode: string | null = null
  let handedOff = false
  let requested = false
  try {
    const invite = code
      ? await giveawayOperation(
          {
            operationId,
            operation: 'requiredServer.invite.resolve',
            method: 'GET',
            path: '/invites/[REDACTED]',
          },
          () => Invite.fetch(client, code),
        )
      : null
    if (
      invite &&
      (!invite.isGuild() ||
        (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) ||
        (invite.maxUses &&
          invite.uses !== null &&
          invite.uses >= invite.maxUses))
    )
      throw new GiveawayError('server')
    const guildId = byId ? input : invite?.guildSnapshot?.id
    if (!guildId || !client.user?.id) throw new GiveawayError('server')
    const bot = await freshMember(client, guildId, client.user.id, operationId)
    if (!bot) throw new GiveawayError('server')
    // A different member lookup confirms this is not merely access to the bot's own record.
    const members = await giveawayOperation(
      {
        operationId,
        operation: 'requiredServer.members.probe',
        method: 'GET',
        path: `/guilds/${guildId}/members`,
      },
      () => client.rest.get(`/guilds/${guildId}/members?limit=1`),
    )
    if (!Array.isArray(members)) throw new GiveawayError('server')
    if (invite)
      return { requiredServerId: guildId, requiredServerInvite: input }
    const channels = (await giveawayOperation(
      {
        operationId,
        operation: 'requiredServer.channels',
        method: 'GET',
        path: `/guilds/${guildId}/channels`,
      },
      () => client.rest.get(`/guilds/${guildId}/channels`),
    )) as {
      id: string
      type: number
    }[]
    for (const channel of channels.filter((item) =>
      [0, 5].includes(item.type),
    )) {
      if (
        !(await channelPermissions(
          client,
          guildId,
          channel.id,
          ['ViewChannel', 'CreateInstantInvite'],
          operationId,
        ))
      )
        continue
      await hooks.beforeCreate?.(channel.id)
      requested = true
      const path = `/channels/${channel.id}/invites`
      const body = { max_age: 0, max_uses: 0, temporary: false, unique: true }
      const created = (await giveawayOperation(
        {
          operationId,
          operation: 'requiredServer.invite.create',
          method: 'POST',
          path,
          request: body,
        },
        () => client.rest.post(path, { body }),
      )) as {
        code?: string
        max_age?: number
        max_uses?: number
        type?: number
        temporary?: boolean
        guild?: { id?: string }
        channel?: { id?: string }
        expires_at?: string | null
      }
      const metadataErrors = [
        ...(!created?.code || !/^[\w-]{1,128}$/.test(created.code)
          ? ['code']
          : []),
        ...(created?.type !== 0 ? ['type'] : []),
        ...(created?.guild?.id !== guildId ? ['guild.id'] : []),
        ...(created?.channel?.id !== channel.id ? ['channel.id'] : []),
      ]
      if (metadataErrors.length) {
        const failure = new GiveawayError('invitePending', {
          cause: Object.assign(new Error('Unverifiable invite response'), {
            errors: metadataErrors.map((path) => ({
              path,
              message: 'Unexpected invite metadata',
            })),
          }),
        })
        logGiveawayFailure(failure, {
          operationId,
          operation: 'requiredServer.invite.validate',
        })
        throw failure
      }
      if (!created.code) throw new GiveawayError('invitePending')
      ownedCode = created.code
      const verified =
        created.max_age === 0 &&
        created.max_uses === 0 &&
        created.temporary === false &&
        created.expires_at == null
      const server = {
        code: ownedCode,
        requiredServerId: guildId,
        requiredServerInvite: `https://fluxer.gg/${ownedCode}`,
        verified,
      }
      if (hooks.onCreated) {
        await hooks.onCreated(server)
        handedOff = true
      }
      if (!verified) {
        const fields = [
          ...(created.max_age !== 0 ? ['max_age'] : []),
          ...(created.max_uses !== 0 ? ['max_uses'] : []),
          ...(created.temporary !== false ? ['temporary'] : []),
          ...(created.expires_at != null ? ['expires_at'] : []),
        ]
        const failure = new GiveawayError('invitePermission', {
          cause: Object.assign(
            new Error('Invite response is not permanent and unlimited'),
            {
              errors: fields.map((path) => ({
                path,
                message: 'Permanent, unlimited, non-temporary invite required',
              })),
            },
          ),
        })
        logGiveawayFailure(failure, {
          operationId,
          operation: 'requiredServer.invite.validate',
        })
        throw failure
      }
      return {
        requiredServerId: guildId,
        requiredServerInvite: server.requiredServerInvite,
      }
    }
    throw new GiveawayError('invitePermission')
  } catch (error) {
    const status = httpStatus(error)
    if (
      requested &&
      !ownedCode &&
      status !== undefined &&
      [400, 401, 403, 404, 429].includes(status)
    )
      await hooks.onRejected?.().catch((failure) =>
        logGiveawayFailure(failure, {
          operationId,
          operation: 'requiredServer.invite.rejection.save',
        }),
      )
    if (ownedCode && !handedOff)
      await deleteCreatedInvite(client, ownedCode, operationId).catch(
        (cleanupError) => {
          logGiveawayFailure(cleanupError, {
            operationId,
            operation: 'requiredServer.invite.compensate',
          })
        },
      )
    if (error instanceof GiveawayError) throw error
    if (
      requested &&
      !ownedCode &&
      ![400, 401, 403, 404, 429].includes(status ?? 0)
    )
      throw new GiveawayError('invitePending', { cause: error })
    if (status === undefined || status === 429 || status >= 500)
      throw new GiveawayError('pending', { cause: error })
    throw new GiveawayError(byId ? 'invitePermission' : 'server', {
      cause: error,
    })
  }
}

export async function deleteCreatedInvite(
  client: Client,
  code: string,
  operationId: string,
) {
  if (!/^[\w-]{1,128}$/.test(code)) throw new GiveawayError('invitePending')
  try {
    await giveawayOperation(
      {
        operationId,
        operation: 'requiredServer.invite.delete',
        method: 'DELETE',
        path: '/invites/[REDACTED]',
      },
      () => client.rest.delete(`/invites/${code}`),
    )
  } catch (error) {
    if (httpStatus(error) !== 404 || apiCode(error) !== 'UNKNOWN_INVITE')
      throw error
  }
}
