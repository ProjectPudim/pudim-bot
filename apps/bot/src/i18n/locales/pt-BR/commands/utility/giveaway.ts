export default {
  failed: 'Não consegui executar essa ação. Tente novamente em instantes.',
  rerolled: (id: string) =>
    `Eu acabei de sortear os ganhadores do sorteio com ID \`${id}\` novamente, como você pediu!`,
  usage: {
    title: 'Como usar os sorteios',
    description:
      'Crie **sorteios personalizados** e selecione **ganhadores** entre os participantes elegíveis. A participação acontece pela **reação** indicada na mensagem.',
    commands: 'Comandos disponíveis',
    arguments: 'Argumentos',
    requirements: 'Requisitos',
    argumentsDescription: [
      '`channel`: canal ou ID opcional; usa o canal atual quando omitido.',
      '`duration`: duração, como `30m`, `12h`, `2d` ou `1d12h`.',
      '`winners`: quantidade de ganhadores (1 a 20).',
      '`prize`: prêmio; pode conter espaços.',
      '`messageUrl`: link ou ID da mensagem do sorteio.',
      '`flags`: opções descritas abaixo.',
    ].join('\n'),
    messageArgument:
      '`messageUrl`: link ou ID da mensagem original de um sorteio deste servidor.',
    requirementsDescription: [
      'Você precisa de **Gerenciar Servidor**.',
      'O bot precisa ver o canal, enviar mensagens e embeds, ler o histórico e adicionar reações.',
      'Emojis externos precisam da permissão correspondente.',
      'Para exigir outro servidor, o bot precisa estar nele e poder consultar membros; se usar ID, precisa criar convite permanente.',
    ].join('\n'),
    flags: 'Opções do create',
    participation: 'Como participar',
    participationText:
      'Reaja com o emoji indicado para **entrar**; remova a reação para **sair**. Bots não participam. Todos os cargos e tempos exigidos são verificados na entrada e novamente no resultado. Permaneça nos servidores exigidos até a confirmação.',
    examples: 'Exemplo',
    example: (prefix: string, sub: string) =>
      sub === 'create'
        ? `\`${prefix}giveaway create #sorteios 2d 1 Nitro --emoji 🎉 --requiredJoinedAt 5d\``
        : `\`${prefix}giveaway ${sub} 123456789012345678\``,
  },
  title: 'Sorteios',
  invalidUsage: 'Uso inválido.',
  description:
    'Crie sorteios personalizados e participe pela reação indicada. Os requisitos são verificados na entrada e novamente ao selecionar os Ganhadores.',
  subcommands: {
    create: 'Cria um sorteio no canal atual ou no canal informado.',
    reroll: 'Seleciona novos Ganhadores de um sorteio encerrado.',
    cancel: 'Cancela um sorteio ativo sem selecionar Ganhadores.',
  },
  help: {
    arguments: 'Argumentos',
    flags: 'Flags do create',
    examples: 'Exemplos',
    participation: 'Participação e requisitos',
    participationText:
      'Reaja com o emoji indicado para entrar; remova a reação para sair. Bots não participam. Todos os cargos exigidos são obrigatórios. Os tempos são exatos (2d = 48 horas). É necessário permanecer nos servidores exigidos até a confirmação do resultado.',
    channel: 'Canal opcional; se omitido, utiliza o canal atual.',
    duration: 'Duração do sorteio: 30m, 12h, 2d, 1w ou 1d12h.',
    winners: 'Quantidade inteira e positiva de Ganhadores.',
    prize: 'Prêmio; pode conter espaços.',
    messageId: 'ID da mensagem original de um sorteio deste servidor.',
    administration: (permission: string) =>
      `As ações create, reroll e cancel exigem a permissão **${permission}**.`,
    createExample: (prefix: string) =>
      `${prefix}giveaway create #sorteios 2d 1 Discord Nitro --emoji 🎁 --requiredJoinedAt 5d`,
  },
  flags: {
    title: 'Título personalizado.',
    description: 'Descrição exibida antes das informações obrigatórias.',
    color: 'Cor hexadecimal, como #ffffff.',
    emoji: 'Emoji Unicode ou personalizado para participar.',
    image: 'URL pública da imagem principal.',
    thumbnail: 'URL pública da miniatura.',
    host: 'Menção ou ID do organizador exibido (não concede permissões).',
    requiredRoles:
      'Menções ou IDs separados por vírgulas; exige todos os cargos.',
    requiredJoinedAt: 'Tempo mínimo no servidor, como 2d ou 1d12h.',
    requiredAccountAge: 'Idade mínima da conta, como 5d ou 1w.',
    requiredServer:
      'Convite válido do Fluxer ou ID de outro servidor onde o Pudim esteja.',
  },
  errors: {
    creationPending:
      'A criação ficou pendente após uma falha. O registro foi preservado para recuperação; não é necessário repetir o comando. Consulte os logs para acompanhar a operação.',
    invitePending:
      'Não foi possível confirmar a criação do convite. O sorteio não foi publicado. Verifique a operação nos logs antes de tentar novamente, para evitar convites duplicados.',
    apiRejected:
      'A API recusou uma etapa da criação. O sorteio não foi ativado; os detalhes da operação e dos campos rejeitados estão nos logs.',
    duration: 'Duração inválida. Utilize 30m, 12h, 2d, 1w ou 1d12h.',
    minDuration: 'A duração mínima de um sorteio é de 1 minuto.',
    winners: (max: number) =>
      `Informe uma quantidade inteira de Ganhadores entre 1 e ${max}.`,
    channel:
      'Informe um canal de texto deste servidor em que o Pudim possa ver, enviar mensagens, embeds, ler o histórico e adicionar reações.',
    host: 'Informe uma menção ou ID de usuário válido para --host.',
    emoji:
      'O emoji é inválido, foi excluído ou o Pudim não pode utilizá-lo neste canal.',
    roles:
      'Informe somente menções ou IDs de cargos existentes neste servidor, separados por vírgulas (máximo de 20).',
    server:
      'O convite ou servidor obrigatório é inválido, está indisponível ou o Pudim não consegue consultar seus membros.',
    invitePermission:
      'O Pudim precisa poder criar um convite permanente em um canal do servidor obrigatório.',
    notFound: 'Sorteio não encontrado neste servidor.',
    invalidLink: 'Você precisa informar um link válido de mensagem.',
    active: 'Esta operação exige um sorteio ativo.',
    ended:
      'O reroll exige um sorteio encerrado e com o anúncio anterior concluído.',
    busy: 'Este sorteio está sendo processado. Tente novamente em instantes.',
    pending:
      'A verificação está temporariamente indisponível. O resultado permanece pendente e será tentado novamente.',
    tooLong:
      'Os textos e requisitos excedem os limites da embed. Reduza o prêmio, descrição ou requisitos.',
    extra: 'Foram informados argumentos adicionais inesperados.',
  },
  labels: {
    prize: 'Prêmio',
    host: 'Organizador',
    creator: 'Criador',
    channel: 'Canal',
    participants: 'Participantes',
    winners: 'Ganhadores',
    selected: 'Ganhadores selecionados',
    requirements: 'Requisitos',
    ends: 'Encerramento',
    created: 'Criação',
    endedAt: 'Finalizado em',
    status: 'Status',
    emoji: 'Emoji',
    message: 'Mensagem',
    remaining: 'Tempo restante',
  },
  states: {
    creating: 'Preparando',
    active: 'Ativo',
    ending: 'Finalização pendente',
    ended: 'Encerrado',
    cancelled: 'Cancelado',
    rerolling: 'Reroll pendente',
  },
  requirements: {
    roles: (roles: string) =>
      `Possuir todos os cargos ${roles} para participar.`,
    joined: (duration: string) =>
      `Estar no servidor há pelo menos ${duration}.`,
    account: (duration: string) =>
      `Possuir uma conta com pelo menos ${duration} de idade.`,
    server: (invite: string) =>
      `Entrar no servidor ${invite} e permanecer nele para participar.`,
  },
  reaction: (emoji: string) =>
    `Reaja com ${emoji} para participar. Remova a reação para sair.`,
  feedback: {
    success: 'você entrou no sorteio com sucesso!',
    roles: (roles: string) =>
      `você precisa possuir os cargos ${roles} para participar deste sorteio.`,
    joined: (duration: string) =>
      `você precisa estar no servidor há pelo menos ${duration} para participar.`,
    account: (duration: string) =>
      `sua conta precisa ter pelo menos ${duration} de idade para participar.`,
    server: (invite: string) =>
      `você precisa entrar no servidor ${invite} para participar.`,
    member: 'você precisa estar neste servidor para participar.',
    pending:
      'não foi possível verificar seus requisitos agora. Remova a reação e tente novamente.',
  },
  created: (link: string) =>
    `O sorteio foi criado com sucesso! Vá até o sorteio em: ${link}`,
  completed:
    'Resultado salvo. A mensagem e o anúncio serão atualizados automaticamente caso o envio esteja temporariamente indisponível.',
  cancelled: 'Sorteio cancelado.',
  noWinners: 'Não houve participantes elegíveis.',
  none: 'Nenhum',
  reference: (id: string) => `Giveaway ID: ${id}`,
  resultReference: (id: string, revision: number) =>
    `Sorteio ${id} · Resultado ${revision}`,
  announcement: (
    prize: string,
    winners: string,
    link: string,
    reroll: boolean,
  ) =>
    `${reroll ? '**Novos Ganhadores!**' : '**Sorteio encerrado!**'} ${prize}\n${winners}\n${link}`,

  dm: {
    join: (title: string, end: number, host: string, link: string) =>
      `Você entrou no sorteio **${title}** com sucesso!

**O sorteio acaba em** <t:${end}:f> (<t:${end}:R>).
**Organizador:** ${host}

[Ir para o sorteio](${link})`,
    leave: (title: string, end: number, host: string, link: string) =>
      `Você saiu do sorteio **${title}**.

**O sorteio acaba em** <t:${end}:f> (<t:${end}:R>).
**Organizador:** ${host}

[Ir para o sorteio](${link})`,
  },
  creatorEnded: {
    title: 'O sorteio acabou!',
    description: (title: string, winners: string, link: string) =>
      `O sorteio **${title}** que você criou acabou!

**Ganhadores:** ${winners}

[Ir até o sorteio](${link})`,
  },

  announcements: {
    none: '😭 Aparentemente, ninguém participou deste sorteio...',
    one: (emoji: string, user: string, title: string) =>
      `${emoji} Parabéns ${user} por ganhar o sorteio **${title}**!`,
    many: (emoji: string, title: string, winners: string) =>
      `${emoji} Parabéns aos ganhadores do sorteio **${title}**!\n\n⭐ **Ganhadores:** ${winners}`,
  },
  fallback: {
    join: (title: string) => `você entrou no sorteio **${title}** com sucesso!`,
    leave: (title: string) => `você saiu do sorteio **${title}** com sucesso!`,
  },
}
