import { createRoleplayCommand } from '#bot/managers/roleplay'

export default createRoleplayCommand({
  action: 'poke',
  description: 'Pokes a user.',
  descriptionLocalizations: {
    'pt-BR': 'Cutuca um usuário.',
    'es-ES': 'Da un toque a un usuario.',
  },
  aliases: ['nudge', 'toque', 'cutucar'],
})
