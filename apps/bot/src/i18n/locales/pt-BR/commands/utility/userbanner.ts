import { config, emojis } from '#bot/config'

export default {
  messages: {
    noBanner: (id: string) =>
      `${emojis.error} ${config.separator} O usuário com ID \`${id}\` não possui um banner configurado.`,
  },
  title: (username: string) => `Banner de ${username}`,
  openInBrowser: (url: string) => `[Abrir banner no navegador](${url})`,
}
