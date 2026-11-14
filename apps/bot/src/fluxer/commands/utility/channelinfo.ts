import { ChannelType } from '@fluxerjs/core'
import { createCommand } from '#bot/fluxer'
import { parseChannelId } from '#bot/utils/channel'
import { colors } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'
import { formatDuration } from '#bot/utils/time'

const USAGE = '{prefix}channelinfo [#channel|id]'

export default createCommand({
  name: 'channelinfo',
  description: 'Shows information about a channel.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre um canal.',
    'es-ES': 'Muestra información sobre un canal.',
  },
  category: 'utility',
  usage: USAGE,
  aliases: ['cinfo', 'chaninfo'],
  async run(ctx) {
    const { t, args, author, client, channelId, guildId } = ctx

    let targetId: string | null

    if (args[0]) {
      targetId = parseChannelId(args[0])
      if (!targetId) {
        await ctx.reply({
          content: t('commands.channelinfo.invalidChannel'),
        })
        return
      }
    } else {
      targetId = channelId
    }

    const channel = await client.channels.fetch(targetId).catch(() => null)

    if (!channel) {
      await ctx.reply({
        content: t('commands.channelinfo.notFound'),
      })
      return
    }

    // Ensure the channel is accessible to this guild context when applicable.
    if (
      guildId &&
      channel.isGuild() &&
      channel.guildId &&
      channel.guildId !== guildId
    ) {
      await ctx.reply({
        content: t('commands.channelinfo.notFound'),
      })
      return
    }

    const createdAt = Math.floor(channel.createdAt.getTime() / 1000)

    const typeKey = channelTypeKey(channel.type)
    const translate = t as (key: string, ...args: unknown[]) => string
    const typeLabel = translate(`commands.channelinfo.types.${typeKey}`)

    const lines: string[] = [
      `**${t('commands.channelinfo.labels.name')}:** ${channel.name ?? '—'}`,
      `**${t('commands.channelinfo.labels.id')}:** \`${channel.id}\``,
      `**${t('commands.channelinfo.labels.type')}:** ${typeLabel}`,
      `**${t('commands.channelinfo.labels.created')}:** <t:${createdAt}:f> (<t:${createdAt}:R>)`,
    ]

    if (channel.isGuild() && channel.parentId) {
      let categoryName = t('commands.channelinfo.labels.noCategory')
      try {
        const parent = await client.channels
          .fetch(channel.parentId)
          .catch(() => null)
        if (parent?.name) categoryName = parent.name
      } catch {
        // ignore
      }
      lines.push(
        `**${t('commands.channelinfo.labels.category')}:** ${categoryName}`,
      )
    } else if (channel.isGuild()) {
      lines.push(
        `**${t('commands.channelinfo.labels.category')}:** ${t('commands.channelinfo.labels.noCategory')}`,
      )
    }

    const topic = (channel as { topic?: string | null }).topic
    if (topic !== undefined) {
      lines.push(
        `**${t('commands.channelinfo.labels.topic')}:** ${topic?.trim() ? topic : t('commands.channelinfo.labels.noTopic')}`,
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
        rateLimit && rateLimit > 0
          ? formatDuration(rateLimit * 1000, ctx.locale)
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
      description: lines.join('\n'),
      color: colors.primary,
    })

    await ctx.reply({
      embeds: [embed],
      allowedMentions: {
        parse: [],
        users: [author.id],
        roles: [],
        repliedUser: true,
      },
    })
  },
})

function channelTypeKey(type: ChannelType): string {
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
