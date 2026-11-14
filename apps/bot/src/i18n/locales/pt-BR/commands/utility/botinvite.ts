import { config } from '#bot/utils/config'

export default {
  author: { name: 'Convide o Pudim para seu servidor' },
  description: [
    `Para adicionar o **Pudim** no seu servidor, basta [clicar aqui](${config.links.botInvite}).`,
    `> Caso você precisa de ajuda, entre no [seridor de suporte](${config.links.supportServer}) do Pudim!`,
    ``,
    `-# [Adicione o Pudim](${config.links.botInvite}) **·** [Servidor de Suporte](${config.links.supportServer})`,
  ].join('\n'),
}
