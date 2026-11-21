import type { User } from '@fluxerjs/core'
import { SnowflakeUtil } from '@fluxerjs/util'
import type { RestMember } from '@pudim/shared/types'
import { colors, emojis, images, type BadgeKey } from '#bot/config'
import type { TranslateFunction } from '#bot/i18n'
import {
  Embed,
  formatTimestampPair,
  getUserAvatarUrl,
  getUserBannerUrl,
  safeText,
  toUnixTimestamp,
  truncate,
} from '#bot/utils'
import type { FluxerProfile } from '#bot/utils/fluxer-profile'
import { formatSafeBio } from './bio'
import { formatPublicConnections } from './connections'

const MAX_DESCRIPTION = 4096
const MAX_FIELD_VALUE = 1024
const MAX_FIELD_NAME = 256

export function buildUserInfoEmbeds(params: {
  targetId: string
  user: User | null
  apiUser: FluxerProfile | null
  member: RestMember | null
  t: TranslateFunction
}) {
  const { targetId, user, apiUser, member, t } = params

  const avatarUrl = getUserAvatarUrl(user, { profile: apiUser, size: 512 })
  const bannerUrl = getUserBannerUrl(targetId, user, apiUser, 512)

  const username = apiUser?.username ?? user?.username ?? targetId
  const discriminator = apiUser?.discriminator ?? user?.discriminator ?? '0'
  const displayName =
    apiUser?.global_name?.trim() || user?.globalName?.trim() || username
  const isBot = apiUser?.bot ?? user?.bot ?? false

  const accountType = isBot
    ? t('commands.userinfo.accountType.bot')
    : t('commands.userinfo.accountType.user')

  const createdText = formatTimestampPair(
    SnowflakeUtil.dateFromSnowflake(targetId),
  )

  const badgeEmojis = (apiUser?.badges ?? [])
    .map((badge) => emojis.badges[badge.key as BadgeKey])
    .filter(Boolean)
    .join(' ')

  const userLines: string[] = [
    `### [${safeText(username, 128)}](https://fluxer.com/users/${targetId}) ${badgeEmojis}`.trim(),
    `**${t('commands.userinfo.labels.username')}:** \`${safeText(`${username}#${discriminator}`, 128)}\``,
    `**${t('commands.userinfo.labels.displayName')}:** ${safeText(displayName, 256)}`,
    `**${t('commands.userinfo.labels.id')}:** \`${targetId}\``,
    `**${t('commands.userinfo.labels.accountType')}:** ${accountType}`,
  ]

  if (createdText) {
    userLines.push(
      `**${t('commands.userinfo.labels.created')}:** ${createdText}`,
    )
  }

  const fields: { name: string; value: string; inline: boolean }[] = []

  const bio = apiUser?.profile?.bio?.trim()
  if (bio) {
    fields.push({
      name: truncate(t('commands.userinfo.labels.bio'), MAX_FIELD_NAME),
      value: formatSafeBio(bio, MAX_FIELD_VALUE),
      inline: false,
    })
  }

  const connectionLinks = formatPublicConnections(apiUser?.connected_accounts)
  if (connectionLinks.length) {
    fields.push({
      name: truncate(t('commands.userinfo.labels.connections'), MAX_FIELD_NAME),
      value: truncate(connectionLinks.join(' · '), MAX_FIELD_VALUE),
      inline: false,
    })
  }

  const links: string[] = []
  if (avatarUrl) links.push(t('commands.userinfo.links.avatar', avatarUrl))
  if (bannerUrl) links.push(t('commands.userinfo.links.banner', bannerUrl))
  if (links.length) userLines.push('', `-# ${links.join(' · ')}`)

  const embeds = [
    Embed({
      author: { name: t('commands.userinfo.userTitle') },
      description: truncate(
        userLines.filter(Boolean).join('\n'),
        MAX_DESCRIPTION,
      ),
      color: colors.primary,
      fields,
      thumbnail: avatarUrl ?? images.defaultAvatar,
    }),
  ]

  if (member) {
    const joinedText = formatTimestampPair(member.joined_at)
    const memberRoles = member.roles ?? []
    const roleMentions = memberRoles.length
      ? memberRoles.map((roleId) => `<@&${roleId}>`).join(', ')
      : t('commands.userinfo.labels.noRoles')

    const memberLines: string[] = []
    if (joinedText) {
      memberLines.push(
        `**${t('commands.userinfo.labels.joined')}:** ${joinedText}`,
      )
    }
    memberLines.push(
      `**${t('commands.userinfo.labels.roles')}:** ${truncate(roleMentions, 3000)}`,
    )

    const facts: string[] = []
    if (member.nick) {
      facts.push(
        t('commands.userinfo.facts.nickname', safeText(member.nick, 128)),
      )
    }

    if (member.communication_disabled_until) {
      const timeoutTs = toUnixTimestamp(member.communication_disabled_until)
      if (timeoutTs !== null && timeoutTs > Math.floor(Date.now() / 1000)) {
        facts.push(t('commands.userinfo.facts.timeout', timeoutTs))
      }
    }

    if (facts.length) {
      memberLines.push(
        '',
        `**${t('commands.userinfo.facts.title')}:**`,
        ...facts,
      )
    }

    embeds.push(
      Embed({
        author: { name: t('commands.userinfo.memberTitle') },
        description: truncate(memberLines.join('\n'), MAX_DESCRIPTION),
        color: colors.primary,
      }),
    )
  }

  return embeds
}
