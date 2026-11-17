import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  messages: {
    user: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não consegui um usuário com \`${raw}\`. Por favor, informe um usuário que exista.`,
    channel: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não consegui um canal com \`${raw}\`. Por favor, informe um canal que exista nesse servidor.`,
    role: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não consegui um cargo com \`${raw}\`. Por favor, informe um cargo que exista nesse servidor.`,
    server: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não consegui um servidor com \`${raw}\`. Por favor, informe um servidor que exista.`,
    emoji: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não consegui um emoji com \`${raw}\`. Para que eu possa pegar as informações detalhadas desse emoji, eu preciso estar no mesmo servidor do emoji.`,
    invite: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não consegui um convite com \`${raw}\`. Por favor, informe um convite que exista.`,
  },
}
