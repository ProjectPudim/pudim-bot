import { createCommand } from '#bot/fluxer'

const USAGE = '{prefix}reverse <text>'

export default createCommand({
  name: 'reverse',
  description: 'Reverses a text.',
  descriptionLocalizations: {
    'pt-BR': 'Inverte um texto.',
    'es-ES': 'Invierte un texto.',
  },
  category: 'fun',
  usage: USAGE,
  aliases: ['inverter'],
  async run(ctx) {
    const { t, args, author } = ctx

    const text = args.join(' ').trim()
    if (!text) {
      await ctx.reply({
        content: t('commands.reverse.missingText'),
      })
      return
    }

    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const reversed = [...segmenter.segment(text)]
      .map((segment) => segment.segment)
      .reverse()
      .join('')

    const authorTag = `\`${author.username}#${author.discriminator} (${author.id})\``
    const content = `🔁 ${reversed}\n-# ${t('commands.reverse.reversedBy')}: ${authorTag}`

    if (content.length > 2000) {
      await ctx.reply({
        content: t('commands.reverse.tooLong'),
      })
      return
    }

    await ctx.reply({
      content,
      allowedMentions: {
        parse: [],
        users: [author.id],
        roles: [],
        repliedUser: true,
      },
    })
  },
})
