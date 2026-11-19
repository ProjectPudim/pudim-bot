import { config, emojis } from '#bot/config'

export default {
  messages: {
    status: (author: string, all: string, users: string, apps: string) =>
      `👋 Oii, ${author}! O **sistema de cargos automáticos** do servidor está configurado para:\n> **Todos:** ${all}${emojis.point}**Usuários:** ${users}${emojis.point}**Aplicativos:** ${apps}\n-# Para configurar esse sistema, você pode utilizar \`p.autorole <all|users|apps> <@role>\` para adicionar o cargo na categoria. Caso queira desativar, use \`p.autorole off <all|users|apps>\``,

    success: {
      all: (role: string) =>
        `${emojis.success} O cargo ${role} será entregue para qualquer **usuário ou aplicativo** que entrar no servidor a partir de agora!`,
      users: (role: string) =>
        `${emojis.success} O cargo ${role} será entregue para qualquer **usuário** que entrar no servidor a partir de agora!`,
      apps: (role: string) =>
        `${emojis.success} O cargo ${role} será entregue para qualquer **aplicativo** que entrar no servidor a partir de agora!`,
    },

    disabled: {
      all: `${emojis.success} O sistema de cargos automáticos para **usuários e aplicativos** foi desativado!`,
      users: `${emojis.success} O sistema de cargos automáticos para **usuários** foi desativado!`,
      apps: `${emojis.success} O sistema de cargos automáticos para **aplicativos** foi desativado!`,
    },

    errors: {
      invalidCategory: `${emojis.error} ${config.separator} A categoria informada é **inválida**. Use \`all\`, \`users\` ou \`apps\`.`,
      missingArgs: `${emojis.error} ${config.separator} Você precisa informar a **categoria** e o **cargo**. Exemplo: \`p.autorole users @cargo\`.`,
      missingCategory: `${emojis.error} ${config.separator} Você precisa informar a **categoria** para desativar. Exemplo: \`p.autorole off users\`.`,
      alreadyDisabled: (category: string) =>
        `${emojis.error} ${config.separator} A categoria **${category}** já está desativada.`,
      roleAboveBot: `${emojis.error} ${config.separator} O cargo informado está **acima** do meu cargo mais alto, então não posso entregá-lo.`,
      roleAboveAuthor: `${emojis.error} ${config.separator} O cargo informado está **acima** do seu cargo mais alto.`,
      invalidRoleManaged: `${emojis.error} ${config.separator} O cargo informado não pode ser utilizado (cargo @everyone ou gerenciado por integração).`,
    },
  },
}
