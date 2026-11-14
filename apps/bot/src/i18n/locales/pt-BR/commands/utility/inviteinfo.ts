import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  title: 'Informações do Convite',
  invalidUsage: `${emojis.error} ${config.separator} Para utilizar esse comando, você precisa **informar um convite** ou o **código do convite** para que eu possa pegar suas informações.`,
  notFound: `${emojis.error} ${config.separator} Me desculpe! Eu **não consegui** encontrar esse convite. Por favor, informe um convite que exista.`,
  invalidInvite: `${emojis.error} ${config.separator} O convite que você informou é **inválido**. Por favor, informe um convite válido.`,
  expired: 'Expirado',
  neverExpires: 'Não expira',
  labels: {
    code: 'Código',
    link: 'Link',
    created: 'Criado em',
    expires: 'Expira em',
    uses: 'Usos',
    maxUses: 'Limite de usos',
    inviter: 'Criado por',
    server: 'Servidor',
    serverId: 'ID do servidor',
    members: 'Membros',
    online: 'Online',
    channel: 'Canal',
    unlimited: 'Ilimitado',
    unavailable: 'Indisponível',
  },
  openInBrowser: (url: string) => `[Abrir no navegador](${url})`,
}
