import { createCommand } from '#bot/fluxer'
import { roleplayManager } from '#bot/managers'

const USAGE = '{prefix}yeet <@user|id>'

export default createCommand({
  name: 'yeet',
  description: 'Yeets a user.',
  descriptionLocalizations: {
    'pt-BR': 'Arremessa um usuário.',
    'es-ES': 'Lanza a un usuario.',
  },
  category: 'fun',
  aliases: ['throw', 'lancar', 'arremessar'],
  usage: USAGE,
  async run(ctx) {
    await roleplayManager.command(ctx, 'yeet', USAGE)
  },
})
