import { cdnEmojiURL } from '@fluxerjs/core'
import { SnowflakeUtil } from '@fluxerjs/util'
import { createCommand } from '#bot/fluxer'
import { colors } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'
import { parseEmoji } from '#bot/utils/emojis'

const USAGE = '{prefix}emojiinfo <emoji|id>'

export default createCommand({
  name: 'emojiinfo',
  description: 'Shows information about an emoji.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre um emoji.',
    'es-ES': 'Muestra información sobre un emoji.',
  },
  category: 'utility',
  usage: USAGE,
  aliases: ['einfo', 'emoji'],
  async run(ctx) {
    const { t, args, author, client } = ctx

    const input = args.join(' ').trim()
    if (!input) {
      await ctx.reply({
        content: t('commands.emojiinfo.messages.invalidUsage'),
      })
      return
    }

    const parsed = parseEmoji(input)
    if (!parsed) {
      await ctx.reply({
        content: t('common.invalid.messages.emoji'),
      })
      return
    }

    if (!/^\d{17,20}$/.test(parsed.id)) {
      await ctx.reply({
        content: t('commands.emojiinfo.messages.unicodeNotSupported'),
      })
      return
    }

    const metadata = await client
      .fetchEmojiMetadata(parsed.id)
      .catch(() => null)
    if (!metadata) {
      await ctx.reply({
        content: t('common.notFound.messages.emoji', input),
      })
      return
    }

    const animated = metadata.animated
    const emojiUrl = cdnEmojiURL(metadata.id, animated, { size: 512 })
    const createdAt = Math.floor(
      SnowflakeUtil.dateFromSnowflake(metadata.id).getTime() / 1000,
    )

    let serverName: string | null = null
    if (metadata.guild_id) {
      const guild = await client.guilds
        .fetch(metadata.guild_id)
        .catch(() => null)
      serverName = guild?.name ?? null
    }

    const lines: string[] = [
      `**${t('commands.emojiinfo.labels.emoji')}:** ${parsed.display}`,
      `**${t('commands.emojiinfo.labels.name')}:** ${metadata.name}`,
      `**${t('commands.emojiinfo.labels.id')}:** \`${metadata.id}\``,
      `**${t('commands.emojiinfo.labels.created')}:** <t:${createdAt}:f> (<t:${createdAt}:R>)`,
      `**${t('commands.emojiinfo.labels.animated')}:** ${animated ? t('commands.emojiinfo.labels.yes') : t('commands.emojiinfo.labels.no')}`,
    ]

    if (metadata.guild_id) {
      lines.push('')
      lines.push(
        `**${t('commands.emojiinfo.labels.server')}:** ${serverName ?? t('commands.emojiinfo.labels.unavailable')}`,
      )
      lines.push(
        `**${t('commands.emojiinfo.labels.serverId')}:** \`${metadata.guild_id}\``,
      )
    }

    const embed = Embed({
      author: { name: t('commands.emojiinfo.title') },
      description: lines.join('\n'),
      color: colors.primary,
      thumbnail: emojiUrl,
    })

    embed.setDescription(
      `${lines.join('\n')}\n\n${t('commands.emojiinfo.openInBrowser', emojiUrl)}`,
    )

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
