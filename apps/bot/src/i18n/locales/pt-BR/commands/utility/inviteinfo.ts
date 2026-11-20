import { config, emojis } from '#bot/config'

export default {
  messages: {
    invalidUsage: `${config.separator(emojis.error)} Para utilizar esse comando, você precisa **informar um convite** ou o **código do convite** para que eu possa pegar suas informações.`,
  },
  title: 'Informações do Convite',
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
