import { createCommand } from '#bot/fluxer'
import { roleplayManager } from '#bot/managers'

const USAGE = '{prefix}punch <@user|id>'

export default createCommand({
  name: 'punch',
  description: 'Punches a user.',
  descriptionLocalizations: {
    'pt-BR': 'Dá um soco em um usuário.',
    'es-ES': 'Da un puñetazo a un usuario.',
  },
  category: 'fun',
  aliases: ['hit', 'soco', 'murro'],
  usage: USAGE,
  async run(ctx) {
    await roleplayManager.command(ctx, 'punch', USAGE)
  },
})
