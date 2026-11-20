import { config, emojis } from '#bot/config'

export default {
  messages: {
    user: `${config.separator(emojis.error)} O usuário que você informou é **inválido**. Por favor, informe um usuário válido.`,
    channel: `${config.separator(emojis.error)} O canal que você informou é **inválido**. Por favor, informe um canal válido.`,
    role: `${config.separator(emojis.error)} O cargo que você informou é **inválido**. Por favor, informe um cargo válido.`,
    emoji: `${config.separator(emojis.error)} O emoji que você informou é **inválido**. Por favor, informe um emoji válido.`,
    invite: `${config.separator(emojis.error)} O convite que você informou é **inválido**. Por favor, informe um convite válido.`,
  },
}
