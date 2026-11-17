import { createRoleplayCommand } from '#bot/modules/roleplay'

export default createRoleplayCommand({
  action: 'punch',
  description: 'Punches a user.',
  descriptionLocalizations: {
    'pt-BR': 'Dá um soco em um usuário.',
    'es-ES': 'Da un puñetazo a un usuario.',
  },
  aliases: ['hit', 'soco', 'murro'],
})
