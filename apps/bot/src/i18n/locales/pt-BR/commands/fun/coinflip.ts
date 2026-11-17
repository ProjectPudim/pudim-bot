import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  messages: {
    invalidUsage: `${emojis.error} ${config.separator} Para utilizar esse comando, vocé precisa **informar uma moeda**, como \`cara\` ou \`coroa\`, para que eu possa lançar a moeda.`,
  },
  flipping: '🪙 Lançando a moeda...',

  title: 'Resultado',

  heads: 'Cara',

  tails: 'Coroa',

  result: (side: string) => `O resultado foi **${side}**!`,

  win: '**Parabéns**, você ganhou.',

  lose: 'Que pena, você perdeu.',
}
