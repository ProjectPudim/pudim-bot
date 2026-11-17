import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  messages: {
    invalidUsage: `${emojis.error} ${config.separator} Para utilizar esse comando, você precisa **informar um emoji** ou o **ID do emoji** para que eu possa pegar suas informações.`,
    unicodeNotSupported: `${emojis.error} ${config.separator} Me desculpe! Eu não consigo pegar informações sobre esse emoji, pois ele utiliza um emoji Unicode, que eu ainda não consigo pegar informações sobre.`,
  },
  title: 'Informações do Emoji',

  labels: {
    emoji: 'Emoji',
    name: 'Nome',
    id: 'ID',
    created: 'Criado em',
    animated: 'Animado',
    server: 'Servidor',
    serverId: 'ID do servidor',
    yes: 'Sim',
    no: 'Não',
    unavailable: 'Indisponível',
  },

  openInBrowser: (url: string) => `[Abrir no navegador](${url})`,
}
