import { config, emojis } from '#bot/config'

export default {
  messages: {
    missingText: `${emojis.error} ${config.separator} Você precisa informar o **texto** para poder inverter.`,
    tooLong: `${emojis.error} ${config.separator} O texto que você informou é longo demais para ser invertido.`,
  },
  title: 'Reverse',
  reversedBy: 'Texto invertido por',
}
