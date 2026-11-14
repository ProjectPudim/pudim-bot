import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  title: (username: string) => `Banner de ${username}`,
  noBanner: (id: string) =>
    `${emojis.error} ${config.separator} O usuário com ID \`${id}\` não possui um banner configurado.`,
  openInBrowser: (url: string) => `[Abrir banner no navegador](${url})`,
}
