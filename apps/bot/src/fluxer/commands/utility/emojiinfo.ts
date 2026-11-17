import { cdnEmojiURL } from '@fluxerjs/core'
import { SnowflakeUtil } from '@fluxerjs/util'
import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import {
  Embed,
  formatTimestampPair,
  parseEmoji,
  safeReplyMentions,
} from '#bot/utils'

const SNOWFLAKE_PATTERN = /^\d{17,20}$/

export default createCommand({
  name: 'emojiinfo',
  description: 'Shows information about an emoji.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre um emoji.',
    'es-ES': 'Muestra información sobre un emoji.',
  },
  category: Category.Utilities,
  usage: '{prefix}emojiinfo <emoji|id>',
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

    if (!SNOWFLAKE_PATTERN.test(parsed.id)) {
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
    const createdText =
      formatTimestampPair(SnowflakeUtil.dateFromSnowflake(metadata.id)) ?? '—'
    const emojiDisplay = `<${animated ? 'a' : ''}:${metadata.name}:${metadata.id}>`

    let serverName: string | null = null
    if (metadata.guild_id) {
      const guild = await client.guilds
        .fetch(metadata.guild_id)
        .catch(() => null)
      serverName = guild?.name ?? null
    }

    const lines: string[] = [
      `**${t('commands.emojiinfo.labels.emoji')}:** ${emojiDisplay}`,
      `**${t('commands.emojiinfo.labels.name')}:** ${metadata.name}`,
      `**${t('commands.emojiinfo.labels.id')}:** \`${metadata.id}\``,
      `**${t('commands.emojiinfo.labels.created')}:** ${createdText}`,
      `**${t('commands.emojiinfo.labels.animated')}:** ${animated ? t('commands.emojiinfo.labels.yes') : t('commands.emojiinfo.labels.no')}`,
    ]

    if (metadata.guild_id) {
      lines.push(
        '',
        `**${t('commands.emojiinfo.labels.server')}:** ${serverName ?? t('commands.emojiinfo.labels.unavailable')}`,
        `**${t('commands.emojiinfo.labels.serverId')}:** \`${metadata.guild_id}\``,
      )
    }

    lines.push('', t('commands.emojiinfo.openInBrowser', emojiUrl))

    const embed = Embed({
      author: { name: t('commands.emojiinfo.title') },
      description: lines,
      color: colors.primary,
      thumbnail: emojiUrl,
    })

    await ctx.reply({
      embeds: [embed],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
