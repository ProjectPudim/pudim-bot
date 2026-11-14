import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  title: (name: string) => `Banner de ${name}`,
  noBanner: (id: string) => `${emojis.error} ${config.separator} O servidor com ID \`${id}\` não possui um banner configurado.`,
  notFound: `${emojis.error} ${config.separator} Me desculpe! Eu **não consegui** encontrar esse servidor. Por favor, informe um servidor que exista.`,
  openInBrowser: (url: string) => `[Abrir banner no navegador](${url})`,
}
