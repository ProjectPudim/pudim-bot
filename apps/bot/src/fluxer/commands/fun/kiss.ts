import { createCommand } from '#bot/fluxer'
import { roleplayManager } from '#bot/managers'

const USAGE = '{prefix}kiss <@user|id>'

export default createCommand({
  name: 'kiss',
  description: 'Kisses a user.',
  descriptionLocalizations: {
    'pt-BR': 'Beija um usuário.',
    'es-ES': 'Besa a un usuario.',
  },
  category: 'fun',
  aliases: ['beijo', 'beijar', 'smooch'],
  usage: USAGE,
  async run(ctx) {
    await roleplayManager.command(ctx, 'kiss', USAGE)
  },
})
