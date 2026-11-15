import { randomInt } from 'node:crypto'
import { createCommand } from '#bot/fluxer'
import { colors } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'

const USAGE = '{prefix}8ball <question>'
const MAX_QUESTION_LENGTH = 500

export default createCommand({
  name: '8ball',
  description: 'Answers a question with the magic 8-ball.',
  descriptionLocalizations: {
    'pt-BR': 'Responde uma pergunta com a bola mágica.',
    'es-ES': 'Responde una pregunta con la bola mágica.',
  },
  category: 'fun',
  usage: USAGE,
  aliases: ['bola8', 'magic8ball'],
  async run(ctx) {
    const { t, args, author } = ctx

    const question = args.join(' ').trim()
    if (!question) {
      await ctx.reply({
        content: t('commands.8ball.missingQuestion'),
      })
      return
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      await ctx.reply({
        content: t('commands.8ball.tooLong', MAX_QUESTION_LENGTH),
      })
      return
    }

    const categories = ['positive', 'negative', 'neutral'] as const
    const category = categories[randomInt(0, categories.length)]
    const translate = t as (key: string, ...args: unknown[]) => string
    const response = translate(`commands.8ball.responses.${category}`)

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
      allowedMentions: {
        parse: [],
        users: [author.id],
        roles: [],
        repliedUser: true,
      },
    })
  },
})
