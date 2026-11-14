import { config } from "#bot/utils/config";
import { emojis } from "#bot/utils/constants";

export default {
  title: (username: string) => `Banner de ${username}`,
  noBanner: (id: string) => `${emojis.error} ${config.separator} O usuário com ID \`${id}\` não possui um banner configurado.`,
  userNotFound: (raw: string) => `${emojis.error} ${config.separator} Me desculpe! Eu não consegui encontrar usuário com \`${raw}\`. Por favor, informe um usuário que exista.`,
  invalidUser: `${emojis.error} ${config.separator} O usuário que vocé informou é **inválido**. Por favor, informe um usuário válido.`,
  openInBrowser: (url: string) => `[Abrir banner no navegador](${url})`,
}