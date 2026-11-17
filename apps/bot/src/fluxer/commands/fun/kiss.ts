import { createRoleplayCommand } from '#bot/modules/roleplay'

export default createRoleplayCommand({
  action: 'kiss',
  description: 'Kisses a user.',
  descriptionLocalizations: {
    'pt-BR': 'Beija um usuário.',
    'es-ES': 'Besa a un usuario.',
  },
  aliases: ['beijo', 'beijar', 'smooch'],
})
