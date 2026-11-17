import { config, emojis } from '#bot/config'

export default {
  messages: {
    noBanner: (id: string) =>
      `${emojis.error} ${config.separator} O servidor com ID \`${id}\` não possui um banner configurado.`,
  },
  title: (name: string) => `Banner de ${name}`,
  openInBrowser: (url: string) => `[Abrir banner no navegador](${url})`,
}
