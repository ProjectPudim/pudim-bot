import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  title: 'Reverse',
  reversedBy: 'Texto invertido por',
  missingText: `${emojis.error} ${config.separator} Você precisa informar o **texto** para poder inverter.`,
  tooLong: `${emojis.error} ${config.separator} O texto que você informou é longo demais para ser invertido.`,
}
