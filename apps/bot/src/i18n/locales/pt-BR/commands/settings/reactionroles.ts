import { config, emojis } from '#bot/config'

export default {
  guildOnly: `${config.separator(emojis.error)} Este comando só está disponível em servidores.`,

  usage: {
    title: 'Cargos por Reação',
    description:
      'O sistema de **cargo por reação** entrega um cargo automaticamente para quem reagir a uma mensagem configurada, de forma organizada e sem adicionar cargos manualmente.',
    commands: 'Comandos disponíveis',
    arguments: 'Argumentos',
    requirements: 'Requisitos',
    argumentsDescription: [
      '`messageUrl`: link ou ID da mensagem.',
      '`reaction`: emoji da reação.',
      '`role`: cargo ou ID do cargo.',
    ].join('\n'),
    requirementsDescription: [
      'Quem usa precisa da permissão **Gerenciar Cargos**.',
      'O cargo do bot precisa estar acima do cargo entregue.',
    ].join('\n'),
  },

  listTitle: 'Reaction Roles ativos',
  listEmpty: `${config.separator(emojis.error)} Este servidor não possui reaction roles configurados.`,
  limitLine: (current: number) => `-# Total: ${current}`,
  tableHeaders: {
    message: 'Mensagem',
    reaction: 'Reação',
    role: 'Cargo',
  },
  pageIndicator: (current: number, total: number) =>
    `-# Página ${current} de ${total}`,

  title: {
    added: 'Cargo por reação adicionado',
    removed: 'Cargo por reação removido',
    conflict: 'Conflito de configuração',
  },

  messageNotFound: `${config.separator(emojis.error)} Não encontrei essa mensagem neste canal.`,

  error: {
    roleNotFound: `${config.separator(emojis.error)} Esse cargo não existe neste servidor.`,
    everyone: `${config.separator(emojis.error)} Não é possível usar o cargo @everyone.`,
    managed: (role: string) =>
      `${config.separator(emojis.error)} O cargo ${role} é gerenciado por uma integração e não pode ser entregue manualmente.`,
    missingPermission: `${config.separator(emojis.error)} Eu preciso da permissão **Gerenciar Cargos** para entregar cargos.`,
    hierarchy: (role: string) =>
      `${config.separator(emojis.error)} O cargo ${role} está acima (ou na mesma posição) do meu cargo mais alto. Mova o meu cargo para cima dele.`,
  },

  reactionFailed: `${config.separator(emojis.error)} Não consegui reagir à mensagem. Verifique se eu posso ver o canal e adicionar reações, e se o emoji é daqui.`,

  added: (emoji: string, role: string, messageId: string) =>
    `${config.separator(emojis.success)} Quem reagir com ${emoji} na mensagem ${messageId} receberá o cargo ${role}.`,
  removed: (emoji: string, messageId: string, role: string) =>
    `${config.separator(emojis.success)} A reação ${emoji} da mensagem ${messageId} não entrega mais o cargo ${role}.`,
  notFound: `${config.separator(emojis.error)} Não há nenhum cargo configurado com essa reação nessa mensagem.`,
  managedByOther:
    'Essa mensagem já está sendo usada por outro menu do bot e não aceita cargos por reação.',
  emojiInUse: (emoji: string, role: string) =>
    `A reação ${emoji} já entrega o cargo ${role} nessa mensagem. Use \`reactionroles remove\` antes de trocá-la.`,
  roleInUse: (role: string) =>
    `O cargo ${role} já está ligado a outra reação nessa mensagem.`,
}
