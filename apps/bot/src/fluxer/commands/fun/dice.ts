import { randomInt } from 'node:crypto'
import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { Embed, safeReplyMentions } from '#bot/utils'

const DICE_PATTERN = /^(\d+)d(\d+)$/

export default createCommand({
  name: 'dice',
  description: 'Rolls dice.',
  descriptionLocalizations: {
    'pt-BR': 'Rola dados.',
    'es-ES': 'Lanza dados.',
  },
  category: Category.Fun,
  usage: '{prefix}dice [NdS]',
  aliases: ['roll'],
  async run(ctx) {
    const { t, args, author } = ctx
    const input = (args[0] ?? '1d6').toLowerCase()
    const match = DICE_PATTERN.exec(input)

    if (!match) {
      await ctx.reply({
        content: t('commands.dice.messages.invalidFormat'),
      })
      return
    }

    const count = Number(match[1])
    const sides = Number(match[2])

    if (
      !Number.isInteger(count) ||
      !Number.isInteger(sides) ||
      count < 1 ||
      count > 50 ||
      sides < 2 ||
      sides > 1000
    ) {
      await ctx.reply({
        content: t('commands.dice.messages.limits'),
      })
      return
    }

    const rolls = Array.from({ length: count }, () => randomInt(1, sides + 1))
    const total = rolls.reduce((sum, value) => sum + value, 0)
    const notation = `${count}d${sides}`

    const embed =
      count === 1
        ? Embed({
            title: t('commands.dice.title', notation),
            description: String(rolls[0]),
            color: colors.primary,
          })
        : Embed({
            title: t('commands.dice.title', notation),
            description: [
              t('commands.dice.rolls', rolls.join(', ')),
              t('commands.dice.total', total),
              '',
            ].join('\n'),
            color: colors.primary,
            fields: [
              {
                name: t('commands.dice.highest'),
                value: String(Math.max(...rolls)),
                inline: true,
              },
              {
                name: t('commands.dice.lowest'),
                value: String(Math.min(...rolls)),
                inline: true,
              },
              {
                name: t('commands.dice.average'),
                value: (total / count).toFixed(1),
                inline: true,
              },
            ],
          })

    await ctx.reply({
      embeds: [embed],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
