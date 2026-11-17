import { randomInt } from 'node:crypto'
import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { Embed } from '#bot/utils'

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
  category: Category.Fun,
  usage: '{prefix}coinflip [cara|coroa]',
  async run(ctx) {
    const { args, t } = ctx
    const rawChoice = args[0]?.toLowerCase()
    const choice = rawChoice ? CHOICES[rawChoice] : undefined

    if (rawChoice && !choice) {
      await ctx.reply({
        content: t('commands.coinflip.messages.invalidUsage'),
      })
      return
    }

    const result: Side = randomInt(0, 2) === 0 ? 'heads' : 'tails'

    const message = await ctx.reply({
      embeds: [Embed(t('commands.coinflip.flipping'), colors.primary)],
    })

    await sleep(500)

    const outcome = choice
      ? ` ${t(choice === result ? 'commands.coinflip.win' : 'commands.coinflip.lose')}`
      : ''
    const description =
      t('commands.coinflip.result', t(`commands.coinflip.${result}`)) + outcome

    await message.edit({
      embeds: [Embed(description, colors.primary)],
    })
  },
})
