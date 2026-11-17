import { Category, colors, emojis } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import type { TranslateFunction } from '#bot/i18n'
import {
  Embed,
  formatTimestampPair,
  formatUserTag,
  getGuildBannerUrl,
  getGuildIconUrl,
  safeReplyMentions,
} from '#bot/utils'

function getVerificationLabel(level: number, t: TranslateFunction): string {
  switch (level) {
    case 0:
      return t('commands.serverinfo.verification.none')
    case 1:
      return t('commands.serverinfo.verification.low')
    case 2:
      return t('commands.serverinfo.verification.medium')
    case 3:
      return t('commands.serverinfo.verification.high')
    case 4:
      return t('commands.serverinfo.verification.veryHigh')
    default:
      return t('commands.serverinfo.unavailable')
  }
}

function getExplicitFilterLabel(level: number, t: TranslateFunction): string {
  switch (level) {
    case 0:
      return t('commands.serverinfo.explicitFilter.disabled')
    case 1:
      return t('commands.serverinfo.explicitFilter.membersWithoutRoles')
    case 2:
      return t('commands.serverinfo.explicitFilter.allMembers')
    default:
      return t('commands.serverinfo.unavailable')
  }
}

export default createCommand({
  name: 'serverinfo',
  description: 'Shows information about the server.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre o servidor.',
    'es-ES': 'Muestra información sobre el servidor.',
  },
  category: Category.Utilities,
  usage: '{prefix}serverinfo',
  aliases: ['sinfo', 'guildinfo'],
  context: 'guild',
  async run(ctx) {
    const { t, author, client, guildId, args } = ctx
    const targetGuildId = args[0]?.trim() || guildId
    if (!targetGuildId) return

    const guild = await client.guilds.fetch(targetGuildId).catch(() => null)
    if (!guild) {
      await ctx.reply({
        content: t('common.notFound.messages.server', targetGuildId),
      })
      return
    }

    const ownerUser = guild.ownerId
      ? await client.users.fetch(guild.ownerId).catch(() => null)
      : null
    const ownerTag = ownerUser
      ? formatUserTag(ownerUser)
      : guild.ownerId
        ? `\`${guild.ownerId}\``
        : t('commands.serverinfo.unavailable')

    const createdText = formatTimestampPair(guild.createdAt) ?? '—'
    const verificationLabel = getVerificationLabel(guild.verificationLevel, t)
    const mfaLabel =
      guild.mfaLevel === 1
        ? t('commands.serverinfo.mfa.elevated')
        : t('commands.serverinfo.mfa.none')
    const explicitLabel = getExplicitFilterLabel(guild.explicitContentFilter, t)
    const notificationLabel =
      guild.defaultMessageNotifications === 0
        ? t('commands.serverinfo.notifications.allMessages')
        : t('commands.serverinfo.notifications.onlyMentions')
    const nsfwLabel =
      guild.nsfwLevel === 3
        ? t('commands.serverinfo.nsfw.ageRestricted')
        : t('commands.serverinfo.nsfw.safe')

    const features = guild.features.length
      ? guild.features.join(', ')
      : t('commands.serverinfo.labels.none')

    const iconUrl = getGuildIconUrl(guild, 256)
    const bannerUrl = getGuildBannerUrl(guild)

    const infoLines: string[] = [
      `**${emojis.database} ${t('commands.serverinfo.topics.server')}:**`,
      `- **${t('commands.serverinfo.labels.name')}:** ${guild.name}`,
      `- **${t('commands.serverinfo.labels.id')}:** \`${guild.id}\``,
      `- **${t('commands.serverinfo.labels.owner')}:** ${ownerTag}`,
      `- **${t('commands.serverinfo.labels.created')}:** ${createdText}`,
      guild.memberCount !== null
        ? guild.onlineCount !== null
          ? t(
              'commands.serverinfo.membersSummary',
              guild.memberCount,
              guild.onlineCount,
            )
          : t('commands.serverinfo.membersSummary', guild.memberCount)
        : `- **${t('commands.serverinfo.labels.members')}:** ${t('commands.serverinfo.unavailable')}.`,
      '',
      `**${emojis.category.moderation} ${t('commands.serverinfo.topics.security')}:**`,
      `- **${t('commands.serverinfo.labels.verification')}:** ${verificationLabel}`,
      `- **${t('commands.serverinfo.labels.mfa')}:** ${mfaLabel}`,
      `- **${t('commands.serverinfo.labels.nsfw')}:** ${nsfwLabel}`,
      `- **${t('commands.serverinfo.labels.explicitFilter')}:** ${explicitLabel}`,
      '',
      `**${emojis.category.settings} ${t('commands.serverinfo.topics.settings')}:**`,
      `- **${t('commands.serverinfo.labels.notifications')}:** ${notificationLabel}`,
      '',
      `**${emojis.sparkles} ${t('commands.serverinfo.topics.resources')}:** ${features}`,
    ]

    const infoEmbed = Embed({
      author: {
        name: t('commands.serverinfo.author', guild.name),
        iconUrl: iconUrl ?? undefined,
      },
      description: infoLines,
      color: colors.primary,
      thumbnail: iconUrl ?? undefined,
      image: bannerUrl ?? undefined,
    })

    await ctx.reply({
      embeds: [infoEmbed],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
