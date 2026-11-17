import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  messages: {
    user: `${emojis.error} ${config.separator} O usuário que você informou é **inválido**. Por favor, informe um usuário válido.`,
    channel: `${emojis.error} ${config.separator} O canal que você informou é **inválido**. Por favor, informe um canal válido.`,
    role: `${emojis.error} ${config.separator} O cargo que você informou é **inválido**. Por favor, informe um cargo válido.`,
    emoji: `${emojis.error} ${config.separator} O emoji que você informou é **inválido**. Por favor, informe um emoji válido.`,
    invite: `${emojis.error} ${config.separator} O convite que você informou é **inválido**. Por favor, informe um convite válido.`,
  },
}
