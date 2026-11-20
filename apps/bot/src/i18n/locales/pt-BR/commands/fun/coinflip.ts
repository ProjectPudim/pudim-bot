import { config, emojis } from '#bot/config'

export default {
  messages: {
    invalidUsage: `${config.separator(emojis.error)} Para utilizar esse comando, você precisa **informar um lado da moeda**, como \`cara\` ou \`coroa\`, para que eu possa lançar a moeda.`,
  },
  flipping: '🪙 Lançando a moeda...',
  title: 'Resultado',
  heads: 'Cara',
  tails: 'Coroa',
  result: (side: string) => `O resultado foi **${side}**!`,
  win: '**Parabéns**, você ganhou.',
  lose: 'Que pena, você perdeu.',
}
