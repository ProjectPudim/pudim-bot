import { randomInt } from 'node:crypto'
import { createCommand } from '#bot/fluxer'
import { colors } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'

const USAGE = '{prefix}choose <option1> | <option2> | ...'
const MAX_OPTIONS = 20
const MAX_OPTION_LENGTH = 100

export default createCommand({
  name: 'choose',
  description: 'Chooses between options.',
  descriptionLocalizations: {
    'pt-BR': 'Escolhe entre opções.',
    'es-ES': 'Elige entre opciones.',
  },
  category: 'fun',
  usage: USAGE,
  aliases: ['escolher'],
  async run(ctx) {
    const { t, args, author } = ctx

    const input = args.join(' ').trim()
    if (!input) {
      await ctx.reply({
        content: t('commands.choose.invalidOptions', ctx.prefix),
      })
      return
    }

    const options = input
      .split('|')
      .map((option) => option.trim())
      .filter((option) => option.length > 0)

    if (options.length < 2) {
      await ctx.reply({
        content: t('commands.choose.invalidOptions', ctx.prefix),
      })
      return
    }

    if (options.length > MAX_OPTIONS) {
      await ctx.reply({
        content: t('commands.choose.tooManyOptions', MAX_OPTIONS),
      })
      return
    }

    if (options.some((option) => option.length > MAX_OPTION_LENGTH)) {
      await ctx.reply({
        content: t('commands.choose.tooLong', MAX_OPTION_LENGTH),
      })
      return
    }

    const chosen = options[randomInt(0, options.length)]

    const embed = Embed({
      title: `🎲 ${t('commands.choose.title')}`,
      description: chosen,
      color: colors.primary,
      fields: [
        {
          name: t('commands.choose.options', options.length),
          value: options
            .map((option, index) => `${index + 1}. ${option}`)
            .join('\n'),
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
