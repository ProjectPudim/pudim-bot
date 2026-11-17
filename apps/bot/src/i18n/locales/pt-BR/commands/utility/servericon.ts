import { config, emojis } from '#bot/config'

export default {
  messages: {
    noIcon: (id: string) =>
      `${emojis.error} ${config.separator} O servidor com ID \`${id}\` não possui um ícone configurado.`,
  },
  title: (name: string) => `Ícone de ${name}`,
  openInBrowser: (url: string) => `[Abrir ícone no navegador](${url})`,
}
