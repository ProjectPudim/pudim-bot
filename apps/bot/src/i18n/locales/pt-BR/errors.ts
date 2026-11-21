export default {
  invalidUser: 'Usuário inválido',
  limitExceeded: 'Limite excedido',
  embed: {
    emptyEmbed: (_params: string) =>
      'Informe pelo menos um argumento, como `--title` ou `--description`.',
    unexpectedText: (params: string) =>
      `Encontrei texto fora de um argumento: ${params}. Todo valor precisa vir depois de um argumento.`,
    unknownArgument: (params: string) =>
      `Argumento desconhecido: ${params}. Confira se digitou o nome certo.`,
    argumentNotAllowed: (params: string) =>
      `Esse comando não permite usar: ${params}.`,
    duplicateArgument: (params: string) =>
      `Você usou o mesmo argumento mais de uma vez: ${params}.`,
    emptyArgument: (params: string) => `Falta o valor de: ${params}.`,
    titleTooLong: (_params: string) =>
      'O título pode ter no máximo **256** caracteres.',
    descriptionTooLong: (_params: string) =>
      'A descrição pode ter no máximo **4096** caracteres.',
    footerTextTooLong: (_params: string) =>
      'O texto do rodapé pode ter no máximo **2048** caracteres.',
    authorNameTooLong: (_params: string) =>
      'O nome do autor pode ter no máximo **256** caracteres.',
    embedTooLong: (params: string) =>
      `A soma dos textos da embed (${params}) pode ter no máximo **6000** caracteres.`,
    invalidColor: (_params: string) =>
      'A cor é inválida. Use hexadecimal, como `#F7D174` ou `#FFF`.',
    invalidTimestamp: (_params: string) =>
      'Valor inválido para o timestamp. Use `true` ou `false`.',
    invalidImageUrl: (_params: string) =>
      'O link da imagem é inválido. Use um link `http` ou `https` de imagem.',
    invalidThumbnailUrl: (_params: string) =>
      'O link da miniatura é inválido. Use um link `http` ou `https` de imagem.',
    invalidFooterIconUrl: (_params: string) =>
      'O link do ícone do rodapé é inválido. Use `http` ou `https`.',
    invalidAuthorIconUrl: (_params: string) =>
      'O link do ícone do autor é inválido. Use `http` ou `https`.',
    invalidAuthorUrl: (_params: string) =>
      'O link do autor é inválido. Use `http` ou `https`.',
    footerIconRequiresText: (_params: string) =>
      'O ícone do rodapé precisa de um texto. Informe `--footer.text`.',
    authorRequiresName: (params: string) =>
      `${params} precisa de um nome de autor. Informe \`--author.name\`.`,
  },
  invalidUsage: 'Uso inválido',
  invalidArgument: 'Argumento inválido',
  notFound: 'Não encontrado',
  actionFailed: 'Ação falhou',
  roleHierarchy: 'Erro de hierarquia de cargo',
  onlyGuild: {
    title: 'Apenas servidores',
    description: 'Esse comando só pode ser utilizado em servidores.',
  },
}
