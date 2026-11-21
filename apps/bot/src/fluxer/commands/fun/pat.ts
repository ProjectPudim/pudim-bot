import { createRoleplayCommand } from '#bot/managers/roleplay'

export default createRoleplayCommand({
  action: 'pat',
  description: 'Pats a user.',
  descriptionLocalizations: {
    'pt-BR': 'Faz carinho em um usuário.',
    'es-ES': 'Hace caricias a un usuario.',
  },
  aliases: ['cafune', 'carinho', 'headpat'],
})
