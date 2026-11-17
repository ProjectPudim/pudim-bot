import { randomInt } from 'node:crypto'
import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { Embed, safeReplyMentions } from '#bot/utils'

const MAX_QUESTION_LENGTH = 500
const RESPONSE_CATEGORIES = ['positive', 'negative', 'neutral'] as const

export default createCommand({
  name: '8ball',
  description: 'Answers a question with the magic 8-ball.',
  descriptionLocalizations: {
    'pt-BR': 'Responde uma pergunta com a bola mágica.',
    'es-ES': 'Responde una pregunta con la bola mágica.',
  },
  category: Category.Fun,
  usage: '{prefix}8ball <question>',
  aliases: ['bola8', 'magic8ball'],
  async run(ctx) {
    const { t, args, author } = ctx
    const question = args.join(' ').trim()

    if (!question) {
      await ctx.reply({
        content: t('commands.8ball.messages.missingQuestion'),
      })
      return
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      await ctx.reply({
        content: t('commands.8ball.messages.tooLong', MAX_QUESTION_LENGTH),
      })
      return
    }

    const category =
      RESPONSE_CATEGORIES[randomInt(0, RESPONSE_CATEGORIES.length)]!
    const response = t(`commands.8ball.responses.${category}`)

    const embed = Embed({
      title: `🎱 ${t('commands.8ball.title')}`,
      color: colors.primary,
      fields: [
        {
          name: `❓ ${t('commands.8ball.question')}`,
          value: question,
          inline: false,
        },
        {
          name: `🎱 ${t('commands.8ball.answer')}`,
          value: response,
          inline: false,
        },
      ],
    })

    await ctx.reply({
      embeds: [embed],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
