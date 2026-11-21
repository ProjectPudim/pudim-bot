import type { GiveawayRecord } from '@pudim/database'
import type { Language, TranslateFunction } from '#bot/i18n'
import { Embed, EMBED_LIMITS } from '#bot/utils/embed'
import { formatDuration } from '#bot/utils/time'
import { GiveawayError, messageLink } from './helpers'

export function requirements(giveaway: GiveawayRecord, t: TranslateFunction) {
  const lines: string[] = []
  if (giveaway.requiredRoleIds.length)
    lines.push(
      t(
        'commands.giveaway.requirements.roles',
        giveaway.requiredRoleIds.map((id) => `<@&${id}>`).join(', '),
      ),
    )
  if (giveaway.requiredJoinedDuration)
    lines.push(
      t(
        'commands.giveaway.requirements.joined',
        formatDuration(giveaway.requiredJoinedDuration, t),
      ),
    )
  if (giveaway.requiredAccountAgeDuration)
    lines.push(
      t(
        'commands.giveaway.requirements.account',
        formatDuration(giveaway.requiredAccountAgeDuration, t),
      ),
    )
  if (giveaway.requiredServerId)
    lines.push(
      t(
        'commands.giveaway.requirements.server',
        giveaway.requiredServerInvite ?? giveaway.requiredServerId,
      ),
    )
  return lines
}

const timestamp = (date: Date) =>
  `<t:${Math.floor(new Date(date).getTime() / 1000)}:f>`
const mentions = (ids: string[]) => ids.map((id) => `<@${id}>`).join(', ')

export function giveawayEmbed(
  giveaway: GiveawayRecord,
  participants: number,
  t: TranslateFunction,
  info = false,
) {
  const field = (
    key: keyof Language['commands']['giveaway']['labels'],
    value: string | number,
  ) => `**${t(`commands.giveaway.labels.${key}`)}:** ${value}`
  const lines = [
    ...(giveaway.description ? [giveaway.description, ''] : []),
    field('prize', giveaway.prize),
    field('status', t(`commands.giveaway.states.${giveaway.status}`)),
    field('ends', timestamp(giveaway.endedAt ?? giveaway.endsAt)),
    ...(giveaway.status === 'active'
      ? [t('commands.giveaway.reaction', giveaway.emoji)]
      : []),
  ]
  if (giveaway.status === 'ended' || giveaway.status === 'rerolling')
    lines.push(
      field(
        'selected',
        giveaway.winners.length
          ? mentions(giveaway.winners)
          : t('commands.giveaway.noWinners'),
      ),
    )
  if (info)
    lines.push(
      field('creator', `<@${giveaway.creatorId}>`),
      field('channel', `<#${giveaway.channelId}>`),
      field('created', timestamp(giveaway.createdAt)),
      ...(giveaway.endedAt
        ? [field('endedAt', timestamp(giveaway.endedAt))]
        : []),
      field('emoji', giveaway.emoji),
      field(
        'message',
        messageLink(giveaway.guildId, giveaway.channelId, giveaway.messageId),
      ),
    )
  lines.push(
    '',
    field('winners', giveaway.winnerCount),
    field('host', `<@${giveaway.hostId}>`),
    field('participants', participants),
  )
  const rules = requirements(giveaway, t)
  if (rules.length)
    lines.push(
      '',
      `**${t('commands.giveaway.labels.requirements')}:**`,
      ...rules.map((rule) => `- ${rule}`),
    )
  const description = lines.join('\n')
  const title = giveaway.title ?? t('commands.giveaway.title')
  if (
    description.length > EMBED_LIMITS.description ||
    title.length > EMBED_LIMITS.title ||
    description.length + title.length > EMBED_LIMITS.total
  )
    throw new GiveawayError('tooLong')
  return Embed({
    title,
    description,
    color: giveaway.color ?? undefined,
    image: giveaway.image ?? undefined,
    thumbnail: giveaway.thumbnail ?? undefined,
    footer: { text: t('commands.giveaway.reference', String(giveaway._id)) },
  })
}
