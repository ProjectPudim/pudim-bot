import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  title: (name: string) => `Banner de ${name}`,
  noBanner: (id: string) =>
    `${emojis.error} ${config.separator} O servidor com ID \`${id}\` não possui um banner configurado.`,
  openInBrowser: (url: string) => `[Abrir banner no navegador](${url})`,
}
