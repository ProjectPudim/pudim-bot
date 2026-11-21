import { createRoleplayCommand } from '#bot/managers/roleplay'

export default createRoleplayCommand({
  action: 'slap',
  description: 'Slaps a user.',
  descriptionLocalizations: {
    'pt-BR': 'Dá um tapa em um usuário.',
    'es-ES': 'Da una bofetada a un usuario.',
  },
  aliases: ['tapa', 'smack', 'tapinha'],
})
