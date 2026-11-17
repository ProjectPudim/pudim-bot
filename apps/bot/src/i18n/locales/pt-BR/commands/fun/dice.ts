import { config, emojis } from '#bot/config'

export default {
  messages: {
    invalidFormat: `${emojis.error} ${config.separator} O formato que você informou é **inválido**. Por favor, use a notação \`NdS\`, como: \`2d6\`.`,
    limits: `${emojis.error} ${config.separator} Você atingiu o limite de dados ou lados, por favor informe entre **1 e 50 dados** e **2 e 1000 lados**. *Seriam tantos dados que acabariam caindo da mesa...*`,
  },
  title: (notation: string) => `🎲 ${notation}`,
  rolls: (values: string) => `**Resultados:** ${values}`,
  total: (value: number) => `**Total:** ${value}`,
  highest: 'Maior',
  lowest: 'Menor',
  average: 'Média',
}
