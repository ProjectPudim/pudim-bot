import { createRoleplayCommand } from '#bot/managers/roleplay'

export default createRoleplayCommand({
  action: 'hug',
  description: 'Hugs a user.',
  descriptionLocalizations: {
    'pt-BR': 'Abraça um usuário.',
    'es-ES': 'Abraza a un usuario.',
  },
  aliases: ['abraco', 'abracar', 'embrace'],
})
