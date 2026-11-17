import { createRoleplayCommand } from '#bot/modules/roleplay'

export default createRoleplayCommand({
  action: 'feed',
  description: 'Feeds a user.',
  descriptionLocalizations: {
    'pt-BR': 'Alimenta um usuário.',
    'es-ES': 'Alimenta a un usuario.',
  },
  aliases: ['nom', 'comida', 'alimentar'],
})
