import { ChannelType } from '@fluxerjs/core'
import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import {
  Embed,
  formatDuration,
  formatTimestampPair,
  parseChannelId,
  safeReplyMentions,
} from '#bot/utils'

type ChannelTypeTranslationKey =
  | 'text'
  | 'voice'
  | 'category'
  | 'announcement'
  | 'announcementThread'
  | 'publicThread'
  | 'privateThread'
  | 'forum'
  | 'media'
  | 'link'
  | 'dm'
  | 'groupDm'
  | 'personalNotes'
  | 'unknown'

function resolveChannelTypeKey(type: ChannelType): ChannelTypeTranslationKey {
  switch (type) {
    case ChannelType.GuildText:
      return 'text'
    case ChannelType.GuildVoice:
      return 'voice'
    case ChannelType.GuildCategory:
      return 'category'
    case ChannelType.GuildAnnouncement:
      return 'announcement'
    case ChannelType.AnnouncementThread:
      return 'announcementThread'
    case ChannelType.PublicThread:
      return 'publicThread'
    case ChannelType.PrivateThread:
      return 'privateThread'
    case ChannelType.GuildForum:
      return 'forum'
    case ChannelType.GuildMedia:
      return 'media'
    case ChannelType.GuildLink:
      return 'link'
    case ChannelType.DM:
      return 'dm'
    case ChannelType.GroupDM:
      return 'groupDm'
    case ChannelType.DMPersonalNotes:
      return 'personalNotes'
    default:
      return 'unknown'
  }
}

export default createCommand({
  name: 'channelinfo',
  description: 'Shows information about a channel.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre um canal.',
    'es-ES': 'Muestra información sobre un canal.',
  },
  category: Category.Utilities,
  usage: '{prefix}channelinfo [#channel|id]',
  aliases: ['cinfo', 'chaninfo'],
  async run(ctx) {
    const { t, args, author, client, channelId, guildId, locale } = ctx
    const raw = args[0]?.trim()

    let targetId: string | null = channelId
    if (raw) {
      targetId = parseChannelId(raw)
      if (!targetId) {
        await ctx.reply({
          content: t('common.invalid.messages.channel'),
        })
        return
      }
    }

    const channel = await client.channels.fetch(targetId).catch(() => null)
    if (
      !channel ||
      (guildId &&
        channel.isGuild() &&
        channel.guildId &&
        channel.guildId !== guildId)
    ) {
      await ctx.reply({
        content: t('common.notFound.messages.channel', raw ?? targetId),
      })
      return
    }

    const createdText = formatTimestampPair(channel.createdAt) ?? '—'
    const typeLabel = t(
      `commands.channelinfo.types.${resolveChannelTypeKey(channel.type)}`,
    )

    const lines: string[] = [
      `**${t('commands.channelinfo.labels.name')}:** ${channel.name ?? '—'}`,
      `**${t('commands.channelinfo.labels.id')}:** \`${channel.id}\``,
      `**${t('commands.channelinfo.labels.type')}:** ${typeLabel}`,
      `**${t('commands.channelinfo.labels.created')}:** ${createdText}`,
    ]

    if (channel.isGuild()) {
      let categoryName = t('commands.channelinfo.labels.noCategory')
      if (channel.parentId) {
        const parent = await client.channels
          .fetch(channel.parentId)
          .catch(() => null)
        if (parent?.name) categoryName = parent.name
      }
      lines.push(
        `**${t('commands.channelinfo.labels.category')}:** ${categoryName}`,
      )
    }

    const topic = (channel as { topic?: string | null }).topic
    if (topic !== undefined) {
      lines.push(
        `**${t('commands.channelinfo.labels.topic')}:** ${topic?.trim() || t('commands.channelinfo.labels.noTopic')}`,
      )
    }

    const nsfw = (channel as { nsfw?: boolean }).nsfw
    if (nsfw !== undefined) {
      lines.push(
        `**${t('commands.channelinfo.labels.nsfw')}:** ${nsfw ? t('commands.channelinfo.values.yes') : t('commands.channelinfo.values.no')}`,
      )
    }

    const rateLimit = (channel as { rateLimitPerUser?: number })
      .rateLimitPerUser
    if (rateLimit !== undefined) {
      const slowmodeValue =
        rateLimit > 0
          ? formatDuration(rateLimit * 1000, locale)
          : t('commands.channelinfo.values.disabled')
      lines.push(
        `**${t('commands.channelinfo.labels.slowmode')}:** ${slowmodeValue}`,
      )
    }

    const bitrate = (channel as { bitrate?: number | null }).bitrate
    if (bitrate !== undefined && bitrate !== null) {
      lines.push(`**${t('commands.channelinfo.labels.bitrate')}:** ${bitrate}`)
    }

    const userLimit = (channel as { userLimit?: number | null }).userLimit
    if (userLimit !== undefined) {
      lines.push(
        `**${t('commands.channelinfo.labels.userLimit')}:** ${userLimit && userLimit > 0 ? userLimit : t('commands.channelinfo.values.unlimited')}`,
      )
    }

    const embed = Embed({
      author: { name: t('commands.channelinfo.title') },
      description: lines,
      color: colors.primary,
    })

    await ctx.reply({
      embeds: [embed],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
