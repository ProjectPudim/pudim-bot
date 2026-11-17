import { createCommand } from '#bot/fluxer'
import { roleplayManager } from '#bot/managers'

const USAGE = '{prefix}bonk <@user|id>'

export default createCommand({
  name: 'bonk',
  description: 'Bonks a user on the head.',
  descriptionLocalizations: {
    'pt-BR': 'Dá uma marretada na cabeça de um usuário.',
    'es-ES': 'Da un golpe en la cabeza a un usuario.',
  },
  category: 'fun',
  aliases: ['whack', 'marretada', 'martelada'],
  usage: USAGE,
  async run(ctx) {
    await roleplayManager.command(ctx, 'bonk', USAGE)
  },
})
