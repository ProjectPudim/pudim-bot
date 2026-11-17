import { createCommand } from '#bot/fluxer'
import { roleplayManager } from '#bot/managers'

const USAGE = '{prefix}poke <@user|id>'

export default createCommand({
  name: 'poke',
  description: 'Pokes a user.',
  descriptionLocalizations: {
    'pt-BR': 'Cutuca um usuário.',
    'es-ES': 'Da un toque a un usuario.',
  },
  category: 'fun',
  aliases: ['nudge', 'toque', 'cutucar'],
  usage: USAGE,
  async run(ctx) {
    await roleplayManager.command(ctx, 'poke', USAGE)
  },
})
