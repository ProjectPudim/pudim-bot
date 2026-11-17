import { createCommand } from '#bot/fluxer'
import { roleplayManager } from '#bot/managers'

const USAGE = '{prefix}hug <@user|id>'

export default createCommand({
  name: 'hug',
  description: 'Hugs a user.',
  descriptionLocalizations: {
    'pt-BR': 'Abraça um usuário.',
    'es-ES': 'Abraza a un usuario.',
  },
  category: 'fun',
  aliases: ['abraco', 'abracar', 'embrace'],
  usage: USAGE,
  async run(ctx) {
    await roleplayManager.command(ctx, 'hug', USAGE)
  },
})
