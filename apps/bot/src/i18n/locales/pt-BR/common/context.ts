import { config, emojis } from '#bot/config'

export default {
  guildOnly: `${config.separator(emojis.error)} Este comando só pode ser utilizado dentro de um **servidor**.`,
  dmOnly: `${config.separator(emojis.error)} Este comando só pode ser utilizado em **mensagens diretas**.`,
  concurrency: `${config.separator(emojis.error)} Você já possui uma execução desse comando em andamento. Aguarde finalizar!`,
}
