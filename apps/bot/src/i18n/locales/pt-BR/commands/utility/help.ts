import { config } from '#bot/utils/config'

export default {
  messages: {},
  commandWord: (amount: number) => (amount === 1 ? 'comando' : 'comandos'),
  home: {
    title: 'Ajuda do Pudim',
    description: (prefix: string, lines: string[]) =>
      [
        `Prefixo: \`${prefix}\``,
        `Reaja com o ícone da categoria para abrir ela.`,
        `-# Caso queira usar: \`${prefix}help <category>\` ou \`${prefix}help <command>\` para ser mais direto!`,
        '',
        ...lines,
        '',
        `[Adicione o Pudim](${config.links.botInvite}) · [Servidor de Suporte](${config.links.supportServer})`,
      ].join('\n'),
  },
  command: {
    title: 'Comando',
    howToUse: 'Como usar',
    aliases: { name: 'Sinônimos', none: 'Não possui sinônimos.' },
    category: 'Categoria',
    permissions: {
      name: 'Permissões necessárias',
      none: 'Não requer nenhuma permissão.',
    },
  },
  category: {
    description: (prefix: string, lines: string[]) =>
      [
        `Caso queira, use \`${prefix}help <command>\` para detalhes de um comando especifíco.`,
        '',
        ...(lines.length ? lines : ['Essa categoria não possui comandos...']),
      ].join('\n'),
    pages: (pages: number, current: number, prefix: string) =>
      pages > 1
        ? `Página ${current}/${pages} · Use as setas para navegar`
        : `Use ${prefix}help <command> para detalhes de um comando especifíco.`,
  },
}
