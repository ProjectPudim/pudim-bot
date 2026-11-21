import { createRoleplayCommand } from '#bot/managers/roleplay'

export default createRoleplayCommand({
  action: 'bonk',
  description: 'Bonks a user on the head.',
  descriptionLocalizations: {
    'pt-BR': 'Dá uma marretada na cabeça de um usuário.',
    'es-ES': 'Da un golpe en la cabeza a un usuario.',
  },
  aliases: ['whack', 'marretada', 'martelada'],
})
