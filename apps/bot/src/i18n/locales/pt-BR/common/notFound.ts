import { config, emojis } from '#bot/config'

export default {
  messages: {
    user: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não encontrei nenhum usuário com \`${raw}\`. Por favor, informe um usuário que exista.`,
    channel: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não encontrei nenhum canal com \`${raw}\`. Por favor, informe um canal que exista nesse servidor.`,
    role: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não encontrei nenhum cargo com \`${raw}\`. Por favor, informe um cargo que exista nesse servidor.`,
    server: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não encontrei nenhum servidor com \`${raw}\`. Por favor, informe um servidor que exista.`,
    emoji: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não encontrei nenhum emoji com \`${raw}\`. Para que eu possa pegar as informações detalhadas desse emoji, eu preciso estar no mesmo servidor dele.`,
    invite: (raw: string) =>
      `${emojis.error} ${config.separator} Me desculpe! Eu não encontrei nenhum convite com \`${raw}\`. Por favor, informe um convite válido.`,
  },
}
