import { createCommand } from '#bot/fluxer'
import { roleplayManager } from '#bot/managers'

const USAGE = '{prefix}slap <@user|id>'

export default createCommand({
  name: 'slap',
  description: 'Slaps a user.',
  descriptionLocalizations: {
    'pt-BR': 'Dá um tapa em um usuário.',
    'es-ES': 'Da una bofetada a un usuario.',
  },
  category: 'fun',
  aliases: ['tapa', 'smack', 'tapinha'],
  usage: USAGE,
  async run(ctx) {
    await roleplayManager.command(ctx, 'slap', USAGE)
  },
})
