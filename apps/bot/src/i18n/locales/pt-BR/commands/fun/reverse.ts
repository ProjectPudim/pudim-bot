import { config, emojis } from '#bot/config'

export default {
  messages: {
    missingText: `${config.separator(emojis.error)} Você precisa informar o **texto** para poder inverter.`,
    tooLong: `${config.separator(emojis.error)} O texto que você informou é longo demais para ser invertido.`,
  },
  title: 'Reverse',
  reversedBy: 'Texto invertido por',
}
