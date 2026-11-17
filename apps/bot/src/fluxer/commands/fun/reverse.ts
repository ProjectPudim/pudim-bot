import { Category } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { formatUserTag, safeReplyMentions } from '#bot/utils'

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})

export default createCommand({
  name: 'reverse',
  description: 'Reverses a text.',
  descriptionLocalizations: {
    'pt-BR': 'Inverte um texto.',
    'es-ES': 'Invierte un texto.',
  },
  category: Category.Fun,
  usage: '{prefix}reverse <text>',
  aliases: ['inverter'],
  async run(ctx) {
    const { t, args, author } = ctx
    const text = args.join(' ').trim()

    if (!text) {
      await ctx.reply({
        content: t('commands.reverse.messages.missingText'),
      })
      return
    }

    const reversed = [...graphemeSegmenter.segment(text)]
      .map((segment) => segment.segment)
      .reverse()
      .join('')

    const content = `🔁 ${reversed}\n-# ${t('commands.reverse.reversedBy')}: ${formatUserTag(author)}`

    if (content.length > 2000) {
      await ctx.reply({
        content: t('commands.reverse.messages.tooLong'),
      })
      return
    }

    await ctx.reply({
      content,
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
