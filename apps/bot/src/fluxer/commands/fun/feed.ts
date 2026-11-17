import { createCommand } from '#bot/fluxer'
import { roleplayManager } from '#bot/managers'

const USAGE = '{prefix}feed <@user|id>'

export default createCommand({
  name: 'feed',
  description: 'Feeds a user.',
  descriptionLocalizations: {
    'pt-BR': 'Alimenta um usuário.',
    'es-ES': 'Alimenta a un usuario.',
  },
  category: 'fun',
  aliases: ['nom', 'comida', 'alimentar'],
  usage: USAGE,
  async run(ctx) {
    await roleplayManager.command(ctx, 'feed', USAGE)
  },
})
