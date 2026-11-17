import { createCommand } from '#bot/fluxer'
import { roleplayManager } from '#bot/managers'

const USAGE = '{prefix}wave <@user|id>'

export default createCommand({
  name: 'wave',
  description: 'Waves to a user.',
  descriptionLocalizations: {
    'pt-BR': 'Acena para um usuário.',
    'es-ES': 'Saluda a un usuario.',
  },
  category: 'fun',
  aliases: ['greet', 'tchau', 'acenar'],
  usage: USAGE,
  async run(ctx) {
    await roleplayManager.command(ctx, 'wave', USAGE)
  },
})
