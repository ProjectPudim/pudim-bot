import { createCommand } from '#bot/fluxer'
import { roleplayManager } from '#bot/managers'

const USAGE = '{prefix}pat <@user|id>'

export default createCommand({
  name: 'pat',
  description: 'Pats a user.',
  descriptionLocalizations: {
    'pt-BR': 'Faz carinho em um usuário.',
    'es-ES': 'Hace caricias a un usuario.',
  },
  category: 'fun',
  aliases: ['cafune', 'carinho', 'headpat'],
  usage: USAGE,
  async run(ctx) {
    await roleplayManager.command(ctx, 'pat', USAGE)
  },
})
