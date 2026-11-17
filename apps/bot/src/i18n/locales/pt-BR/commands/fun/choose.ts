import { config, emojis } from '#bot/config'

export default {
  messages: {
    invalidOptions: (p: string) =>
      `${emojis.error} ${config.separator} Eu preciso que você informe ao menos **duas opções** para que eu possa escolher. Por exemplo: \`${p}choose eu vou ser podre de rico | eu vou ser podre de pobre...\``,
    tooManyOptions: (max: number) =>
      `${emojis.error} ${config.separator} Você atingiu o limite de escolhas por comando, por favor informe **${max.toLocaleString('pt-BR')} ou menos** escolhas.`,
    tooLong: (max: number) =>
      `${emojis.error} ${config.separator} Eh, me desculpe! Uma das escolhas atingiu o limite de ${max.toLocaleString('pt-BR')} caracteres por escolha.`,
  },
  title: 'Eu escolho...',
  options: (count: number) => `Opções (${count})`,
}
