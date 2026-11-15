import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  title: (notation: string) => `🎲 ${notation}`,
  rolls: (values: string) => `**Resultados:** ${values}`,
  total: (value: number) => `**Total:** ${value}`,
  highest: 'Maior',
  lowest: 'Menor',
  average: 'Média',
  invalidFormat:
    // 'Formato inválido. Use a notação `NdS`, como `1d6`, `2d20` ou `10d100`.',
    `${emojis.error} ${config.separator} O formato que você informou é **inválido**. Por favor, use a notação \`NdS\`, como: \`2d6\`.`,
  // limits: 'Limites excedidos. Use entre 1 e 50 dados e entre 2 e 1000 lados.',
  limits: `${emojis.error} ${config.separator} Você atingiu o limite de dados ou lados, por favor informe entre **1 e 50 dados** e **2 e 1000 lados**. *Seriam tantos dados que acabariam caindo da mesa...*`,
}
