import { createRoleplayCommand } from '#bot/modules/roleplay'

export default createRoleplayCommand({
  action: 'wave',
  description: 'Waves to a user.',
  descriptionLocalizations: {
    'pt-BR': 'Acena para um usuário.',
    'es-ES': 'Saluda a un usuario.',
  },
  aliases: ['greet', 'tchau', 'acenar'],
})
