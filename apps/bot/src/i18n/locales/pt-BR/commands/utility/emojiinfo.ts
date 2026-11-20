import { config, emojis } from '#bot/config'

export default {
  messages: {
    invalidUsage: `${config.separator(emojis.error)} Para utilizar esse comando, você precisa **informar um emoji** ou o **ID do emoji** para que eu possa pegar suas informações.`,
    unicodeNotSupported: `${config.separator(emojis.error)} Me desculpe! Eu não consigo pegar informações sobre esse emoji, pois ele utiliza um emoji Unicode, sobre o qual ainda não consigo consultar detalhes.`,
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
