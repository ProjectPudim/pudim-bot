import { createCommand } from '#bot/fluxer'
import { colors } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'

type Side = 'heads' | 'tails'

const CHOICES: Record<string, Side> = {
  cara: 'heads',
  coroa: 'tails',
  heads: 'heads',
  tails: 'tails',
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default createCommand({
  name: 'coinflip',
  description: 'Flips a coin.',
  descriptionLocalizations: {
    'pt-BR': 'Joga uma moeda.',
    'es-ES': 'Lanza una moneda.',
  },
  aliases: ['cf'],
  category: 'fun',
  usage: '{prefix}coinflip [cara|coroa]',
  async run(ctx) {
    const { args, t } = ctx

    const choice = CHOICES[args?.[0]?.toLowerCase() ?? '']
    const result: Side = Math.random() < 0.5 ? 'heads' : 'tails'

    if (args?.[0] && !choice) {
      await ctx.reply({
        content: t('commands.coinflip.messages.invalidUsage'),
      })
      return
    }

    const message = await ctx.reply({
      embeds: [
        Embed({
          description: t('commands.coinflip.flipping'),
          color: colors.primary,
        }),
      ],
    })

    await sleep(500)

    let description = t(
      'commands.coinflip.result',
      t(`commands.coinflip.${result}`),
    )

    if (choice) {
      description +=
        ' ' +
        t(
          choice === result
            ? 'commands.coinflip.win'
            : 'commands.coinflip.lose',
        )
    }

    await message.edit({
      embeds: [
        Embed({
          description,
          color: colors.primary,
        }),
      ],
    })
  },
})
