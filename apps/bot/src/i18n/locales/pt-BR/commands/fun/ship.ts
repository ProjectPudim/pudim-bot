import { config, emojis } from '#bot/config'

export default {
  messages: {
    invalidUsage: (p: string) =>
      `${emojis.error} ${config.separator} Para utilizar esse comando, você precisa informar ao menos **uma pessoa** para que o **Oráculo do Destino** possa te dar uma resposta.\n-# Por exemplo: \`${p}ship @Pudim @Felipe\``,
  },
  title:
    '✨ O Oráculo do Destino diz...\n> Sim, **ele não erra**, se errar, foi obra do *Pudim do Destino* que fez algo hein!',
  percentage: (value: number) => `**Chance do casal dar certo:** ${value}%`,
  shipName: (name: string) => `**Nome do casal:** ${name}`,

  results: {
    selfLove: 'Amor próprio é tudo!',
    soulmates:
      'Parem tudo! Vocês são almas gêmeas destinadas pelo universo. Casamento amanhã?',
    perfect: 'Uauu! Que bela combinação, se casem logo! O amor está no ar.',
    potential:
      'Olha só, temos um casal em potencial aqui! Tem muita química entre vocês.',
    friends:
      'Hum... talvez como bons amigos? Existe uma faísca, mas precisa de um empurrãozinho.',
    low: 'É... a situação está meio tensa. Talvez seja melhor focar na amizade.',
    veryLow:
      'Vish! Corram para as montanhas. A compatibilidade é muito baixa, melhor nem tentar.',
  },
}
