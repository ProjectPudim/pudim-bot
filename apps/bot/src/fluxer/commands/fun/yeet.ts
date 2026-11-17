import { createRoleplayCommand } from '#bot/modules/roleplay'

export default createRoleplayCommand({
  action: 'yeet',
  description: 'Yeets a user.',
  descriptionLocalizations: {
    'pt-BR': 'Arremessa um usuário.',
    'es-ES': 'Lanza a un usuario.',
  },
  aliases: ['throw', 'lancar', 'arremessar'],
})
