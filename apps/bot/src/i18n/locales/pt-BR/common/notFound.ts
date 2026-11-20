import { config, emojis } from '#bot/config'

export default {
  messages: {
    user: (raw: string) =>
      `${config.separator(emojis.error)} Me desculpe! Eu não encontrei nenhum usuário com \`${raw}\`. Por favor, informe um usuário que exista.`,
    channel: (raw: string) =>
      `${config.separator(emojis.error)} Me desculpe! Eu não encontrei nenhum canal com \`${raw}\`. Por favor, informe um canal que exista nesse servidor.`,
    role: (raw: string) =>
      `${config.separator(emojis.error)} Me desculpe! Eu não encontrei nenhum cargo com \`${raw}\`. Por favor, informe um cargo que exista nesse servidor.`,
    server: (raw: string) =>
      `${config.separator(emojis.error)} Me desculpe! Eu não encontrei nenhum servidor com \`${raw}\`. Por favor, informe um servidor que exista.`,
    emoji: (raw: string) =>
      `${config.separator(emojis.error)} Me desculpe! Eu não encontrei nenhum emoji com \`${raw}\`. Para que eu possa pegar as informações detalhadas desse emoji, eu preciso estar no mesmo servidor dele.`,
    invite: (raw: string) =>
      `${config.separator(emojis.error)} Me desculpe! Eu não encontrei nenhum convite com \`${raw}\`. Por favor, informe um convite válido.`,
  },
}
