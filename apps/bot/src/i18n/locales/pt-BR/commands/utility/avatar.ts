import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  userNotFound: `${emojis.error} ${config.separator} Me desculpe! O usuário que você informou é **inválido**. Por favor, informe um usuário válido.`,
  title: (u: string) => `Avatar de ${u}`,
  avatarSelf: 'Apesar de tudo, ainda é você.',
  openInBrowser: (url: string) => `[Abrir avatar no navegador](${url})`,
  noAvatar: 'Aparentemente esse usuário não possui um avatar...',
}
