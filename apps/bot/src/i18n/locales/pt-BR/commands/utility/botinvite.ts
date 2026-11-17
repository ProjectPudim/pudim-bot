import { config } from '#bot/config'

export default {
  messages: {},
  author: { name: 'Convide o Pudim para seu servidor' },
  description: [
    `Para adicionar o **Pudim** no seu servidor, basta [clicar aqui](${config.links.botInvite}).`,
    `> Caso você precise de ajuda, entre no [servidor de suporte](${config.links.supportServer}) do Pudim!`,
    '',
    `-# [Adicione o Pudim](${config.links.botInvite}) **·** [Servidor de Suporte](${config.links.supportServer})`,
  ].join('\n'),
}
