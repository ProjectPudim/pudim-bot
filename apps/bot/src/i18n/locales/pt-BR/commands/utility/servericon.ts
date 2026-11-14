import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  title: (name: string) => `Ícone de ${name}`,
  noIcon: (id: string) =>
    `${emojis.error} ${config.separator} O servidor com ID \`${id}\` não possui um ícone configurado.`,
  openInBrowser: (url: string) => `[Abrir ícone no navegador](${url})`,
}
