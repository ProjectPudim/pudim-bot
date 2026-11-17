import { config, emojis } from '#bot/config'

export default {
  guildOnly: `${emojis.error} ${config.separator} Este comando só pode ser utilizado dentro de um **servidor**.`,
  dmOnly: `${emojis.error} ${config.separator} Este comando só pode ser utilizado em **mensagens diretas**.`,
  concurrency: `${emojis.error} ${config.separator} Você já possui uma execução desse comando em andamento. Aguarde finalizar!`,
}
