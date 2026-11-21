function subcommandUsage(
  title: string,
  description: string,
  args: string,
  examples: readonly string[],
  notes = '',
  requirements = '',
) {
  return {
    title: `Ticket: ${title}`,
    description,
    arguments: args,
    examples: (prefix: string) =>
      examples.map((line) => `- \`${prefix}${line}\``).join('\n'),
    notes,
    requirements,
  }
}

const categoryUsage = subcommandUsage(
  'Categorias',
  'Escolha as categorias dos tickets **abertos** e **fechados**. A categoria de fechados só é usada ao **arquivar**; a ação `delete` apaga o canal.',
  '`category`: menção ou ID de uma categoria deste servidor.\n`open|closed`: categoria dos tickets abertos ou arquivados.',
  ['ticket category #atendimentos open', 'ticket category #arquivados closed'],
  'Sem categoria de abertos, a abertura usa a categoria do canal do painel. Ao arquivar, o canal só é movido se a categoria de fechados configurada ainda for válida.',
)
const staffUsage = subcommandUsage(
  'Cargos da equipe',
  'Adicione ou remova **cargos da equipe**. Os cargos configurados recebem acesso nos novos tickets; seus membros podem fechar, reabrir e gerenciar o atendimento.',
  '`add|remove`: adicionar ou remover um cargo.\n`role`: menção ou ID do cargo.',
  ['ticket staffrole add @Suporte', 'ticket staffrole remove @Suporte'],
  'É possível configurar até **10 cargos**. O cargo `@everyone` não é aceito. Use `ticket staffrole list` para consultar a equipe configurada.',
  'As ações de gerenciamento pelo comando também exigem **Gerenciar Servidor**.',
)
const blacklistUsage = subcommandUsage(
  'Lista de bloqueio',
  'Controle quem está **impedido de abrir tickets** pelo painel. Remover alguém da lista permite que volte a abrir tickets.',
  '`add|remove`: bloquear ou desbloquear.\n`user`: menção ou ID do usuário.',
  ['ticket blacklist add @Usuário', 'ticket blacklist remove @Usuário'],
  'Até **200 usuários**. Para adicionar alguém, essa pessoa precisa ser membro do servidor.',
)

export default {
  unknownUser: 'desconhecido',
  usage: {
    title: 'Como usar os tickets',
    description:
      'Configure um **painel de atendimento** com opções por reação. Cada membro pode abrir um **ticket privado**, com acesso para a equipe configurada.',
    commands: 'Comandos disponíveis',
    groups: 'Os comandos estão agrupados abaixo por função.',
    sections: {
      configuration: 'Configuração',
      panel: 'Painel e opções',
      closing: 'Fechamento',
      management: 'Gerenciar tickets',
    },
    arguments: 'Argumentos',
    requirements: 'Requisitos',
    howToUse: 'Como usar',
    details: 'Detalhes',
    examples: 'Exemplos',
    defaults: 'Valor padrão e limite',
    variables: 'Variáveis disponíveis',
    embedFlags: 'Flags da embed',
    managerRequirement:
      'Use em um **servidor**, com a permissão **Gerenciar Servidor**.',
    channel: subcommandUsage(
      'Canal do painel',
      'Defina o **canal onde o painel será enviado** com `ticket panel send`. Cada ticket é criado em um canal privado separado, não dentro desse canal.',
      '`channel`: menção ou ID de um canal de texto ou de anúncios deste servidor.',
      ['ticket channel #atendimento'],
      '',
      'O bot precisa conseguir enviar mensagens no canal.',
    ),
    category: {
      ...categoryUsage,
      open: {
        ...categoryUsage,
        title: 'Ticket: Categoria dos abertos',
        arguments:
          '`category`: menção ou ID da categoria para criar os novos tickets.',
        examples: (prefix: string) =>
          `- \`${prefix}ticket category #atendimentos open\``,
      },
      closed: {
        ...categoryUsage,
        title: 'Ticket: Categoria dos fechados',
        arguments:
          '`category`: menção ou ID da categoria usada ao arquivar tickets.',
        examples: (prefix: string) =>
          `- \`${prefix}ticket category #arquivados closed\``,
      },
    },
    staffrole: {
      ...staffUsage,
      add: subcommandUsage(
        'Adicionar cargo da equipe',
        'Adicione um **cargo da equipe** para dar acesso aos novos tickets e autorizar o gerenciamento pelos seus membros.',
        '`role`: menção ou ID de um cargo deste servidor, exceto `@everyone`.',
        ['ticket staffrole add @Suporte'],
        'Até **10 cargos** podem ser configurados. O mesmo cargo não pode ser adicionado duas vezes.',
      ),
      remove: subcommandUsage(
        'Remover cargo da equipe',
        'Remova um **cargo da configuração da equipe**. Os novos tickets não darão acesso por esse cargo.',
        '`role`: menção ou ID de um cargo configurado.',
        ['ticket staffrole remove @Suporte'],
        'Esta alteração não remove permissões dos canais já criados.',
      ),
    },
    logchannel: subcommandUsage(
      'Canal de logs',
      'Escolha onde registrar **aberturas, falhas de abertura, fechamentos, reaberturas e transferências** de tickets.',
      '`channel`: menção ou ID de um canal de texto ou de anúncios deste servidor.',
      ['ticket logchannel #logs-tickets'],
      '',
      'O bot precisa conseguir enviar mensagens e embeds no canal.',
    ),
    namepattern: {
      ...subcommandUsage(
        'Padrão de nome',
        'Personalize o **nome dos novos canais de ticket** com texto e variáveis. O número do ticket é preenchido com pelo menos **três dígitos**.',
        '`pattern`: padrão de nome, com até **100 unidades UTF-16**.',
        [
          'ticket namepattern ticket-{ticket.count}',
          'ticket namepattern suporte-{username}-{ticket.count}',
        ],
        'Com usuário `ana` e ticket 7: `ticket-{ticket.count}` resulta em `ticket-007`; `suporte-{username}-{ticket.count}` resulta em `suporte-ana-007`. O nome final é limitado a 100 unidades UTF-16.',
      ),
      defaults: (pattern: string) =>
        `Padrão: \`${pattern}\`.\nLimite do padrão: **100 unidades UTF-16**.`,
      variables: (variables: string, aliases: string) =>
        `${variables}\nAliases aceitos: ${aliases}.`,
    },
    blacklist: {
      ...blacklistUsage,
      add: subcommandUsage(
        'Bloquear usuário',
        'Impeça um membro de **abrir novos tickets** pelo painel.',
        '`user`: menção ou ID de um membro do servidor.',
        ['ticket blacklist add @Usuário'],
        'A lista aceita até **200 usuários**. O mesmo usuário não pode ser adicionado duas vezes.',
      ),
      remove: subcommandUsage(
        'Desbloquear usuário',
        'Permita que alguém da lista de bloqueio **volte a abrir tickets**.',
        '`user`: menção ou ID de um usuário bloqueado.',
        ['ticket blacklist remove @Usuário'],
      ),
    },
    config: subcommandUsage(
      'Configuração atual',
      'Mostra a **configuração atual** do sistema. Execute sem argumentos adicionais.',
      '',
      ['ticket config'],
    ),
    panel: subcommandUsage(
      'Painel',
      'Personalize o **embed do painel de atendimento**. Só os campos informados são alterados; os demais são preservados.',
      '`--title`, `--description`: texto.\n`--color`: hexadecimal, como `#F7D174`.\n`--image`, `--thumbnail`: URL pública de imagem.',
      [
        'ticket panel --title Central de atendimento --description Escolha uma opção: {options} --color #F7D174',
        'ticket panel send',
        'ticket panel preview',
      ],
      'Use **`{options}` na descrição** para mostrar a lista de reações e nomes configurados.\n`send`: envia um novo painel no canal configurado.\n`update`: atualiza a mensagem já enviada e suas reações.\n`preview`: mostra uma prévia sem enviar o painel.\nAutor, rodapé e timestamp não são permitidos. Adicione opções com `ticket option add`.',
      'Para enviar: canal e embed configurados; bot com acesso, envio de mensagens/embeds, histórico, **Adicionar Reações** e **Gerenciar Mensagens**. Para atualizar, o painel precisa ter sido enviado.',
    ),
    option: {
      ...subcommandUsage(
        'Opções do painel',
        'Gerencie os **tipos de atendimento** do painel. Cada opção associa uma **reação** a um nome.',
        '`reaction`: emoji Unicode ou personalizado.\n`name`: nome do tipo de atendimento.',
        [
          'ticket option add 💡 Dúvidas',
          'ticket option remove 💡',
          'ticket option list',
        ],
        '`add`: adiciona uma opção.\n`remove`: remove a opção associada ao emoji.\n`list`: mostra as opções atuais. Alterações tentam atualizar o painel já enviado.',
      ),
      add: subcommandUsage(
        'Adicionar opção',
        'Adicione um **tipo de atendimento**. O emoji vira uma **reação do painel**, usada para abrir o ticket desse tipo.',
        '`reaction`: emoji Unicode ou personalizado.\n`name`: nome da opção, com até **40 caracteres**.',
        ['ticket option add 💡 Dúvidas', 'ticket option add 🛒 Compras'],
        'O painel aceita até **10 opções**. Cada emoji só pode identificar uma opção.',
      ),
      remove: subcommandUsage(
        'Remover opção',
        'Remova um **tipo de atendimento** pelo emoji associado. O painel já enviado é atualizado quando possível.',
        '`reaction`: emoji de uma opção configurada.',
        ['ticket option remove 💡'],
      ),
      list: subcommandUsage(
        'Listar opções',
        'Mostra as **opções configuradas** no painel. Não recebe argumentos adicionais.',
        '',
        ['ticket option list'],
      ),
    },
    welcome: {
      ...subcommandUsage(
        'Boas-vindas',
        'Personalize o **embed enviado ao abrir um ticket**. Use as variáveis abaixo para incluir dados do atendimento; campos omitidos são preservados.',
        'Flags de texto recebem texto; `--color` recebe hexadecimal; flags de imagem e URL recebem links públicos.\n`--footer.text` é necessário para usar `--footer.icon`.\n`--author.name` é necessário para usar ícone ou URL do autor.',
        [
          'ticket welcome --title Olá, {username}! --description Ticket #{ticket.number}: descreva sua solicitação. Reaja com {close.emoji} para fechar. --color #F7D174',
          'ticket welcome preview',
        ],
        '`preview`: visualiza a mensagem configurada, ou a padrão quando não houver personalização. A prévia usa o primeiro tipo configurado e o número 1.\nTimestamp não é aceito. Variáveis desconhecidas são preservadas e geram um aviso ao salvar.',
      ),
      variables: {
        username: 'mostra o nome de usuário de quem abriu o ticket.',
        userId: 'mostra o ID de quem abriu o ticket.',
        userMention: 'menciona quem abriu o ticket.',
        ticketType: 'mostra o tipo de ticket que o usuário abriu.',
        ticketNumber: 'mostra o número do ticket (`001`).',
        ticketChannel: 'menciona o canal do ticket.',
        serverName: 'mostra o nome do servidor.',
        closeEmoji: 'mostra o emoji configurado para fechar o ticket.',
      },
    },
    close: {
      ...subcommandUsage(
        'Fechamento',
        'Feche o **ticket do canal atual**, com um motivo opcional. As configurações abaixo controlam o fechamento pelo comando e pela reação.',
        '`motivo`: texto opcional.',
        [
          'ticket close',
          'ticket close Atendimento concluído',
          'ticket close action archive',
        ],
        '`action`: apagar ou arquivar.\n`delay`: espera antes de fechar.\n`emoji`: reação de fechamento.\n`opener`: permite que o abridor feche.\n`dm`: avisa o abridor por mensagem privada.',
        'Use em um canal de ticket aberto. O fechamento exige staff ou o próprio abridor com a opção habilitada; pelo comando, também é necessário **Gerenciar Servidor**. O bot precisa de **Gerenciar Canais**, **Gerenciar Cargos** e acesso ao canal.',
      ),
      action: subcommandUsage(
        'Ação ao fechar',
        'Escolha entre **apagar** e **arquivar** o canal do ticket. O padrão é **archive**.',
        '`delete`: apaga o canal e o registro do ticket.\n`archive`: mantém o canal, remove o acesso do abridor e dos usuários adicionados e marca o ticket como fechado.',
        ['ticket close action archive', 'ticket close action delete'],
        'No modo `archive`, o canal é movido para a categoria de fechados se ela estiver configurada e for válida. Só tickets arquivados com canal existente podem ser reabertos.',
      ),
      delay: subcommandUsage(
        'Espera para fechar',
        'Configure a **espera antes de fechar** o ticket. O padrão é **5 segundos**.',
        '`seconds`: número inteiro entre **0 e 30**. Use `0` para não esperar.',
        ['ticket close delay 5', 'ticket close delay 0'],
      ),
      emoji: subcommandUsage(
        'Reação de fechamento',
        'Defina a **reação usada para fechar** os tickets. O padrão é **❌**.',
        '`emoji`: emoji Unicode ou personalizado.',
        ['ticket close emoji 🔒'],
        'A reação é vinculada na abertura ou reabertura do ticket; mudar esta configuração não troca as reações já enviadas.',
      ),
      opener: subcommandUsage(
        'Fechamento pelo abridor',
        'Escolha se **quem abriu o ticket pode fechá-lo**. Por padrão, está **ativado**.',
        '`on`: permite ao abridor fechar.\n`off`: só pode fechar se também tiver autorização de staff.',
        ['ticket close opener on', 'ticket close opener off'],
        'O comando continua exigindo **Gerenciar Servidor**; esta configuração também é aplicada ao fechamento por reação.',
      ),
      dm: subcommandUsage(
        'Aviso por DM',
        'Escolha se o **abridor recebe uma mensagem privada** ao fechar o ticket. Por padrão, está **ativado**.',
        '`on`: tenta enviar o aviso.\n`off`: não envia o aviso.',
        ['ticket close dm on', 'ticket close dm off'],
        'A mensagem inclui servidor, ticket, responsável pelo fechamento, datas, duração e motivo quando informado. A entrega depende de o usuário aceitar DMs.',
      ),
    },
    reopen: subcommandUsage(
      'Reabrir ticket',
      'Reabra um **ticket arquivado**, restaurando o acesso do abridor e dos usuários adicionados.',
      '`number`: número do ticket.\n`channel`: menção ou ID do canal do ticket.',
      ['ticket reopen 7', 'ticket reopen #ticket-007'],
      '',
      'O ticket precisa estar fechado e seu canal ainda existir. É necessário ser staff, além de **Gerenciar Servidor**. O bot precisa de **Gerenciar Canais**, **Gerenciar Cargos** e acesso ao canal.',
    ),
    add: subcommandUsage(
      'Adicionar usuário',
      'Dê **acesso ao ticket atual** a outro membro do servidor.',
      '`user`: menção ou ID de um membro.',
      ['ticket add @Usuário'],
      '',
      'Use dentro de um canal de ticket, como staff e com **Gerenciar Servidor**. O bot precisa de **Gerenciar Canais**, **Gerenciar Cargos** e acesso ao canal.',
    ),
    remove: subcommandUsage(
      'Remover usuário',
      'Remova o **acesso individual** de um usuário ao ticket atual.',
      '`user`: menção ou ID do usuário.',
      ['ticket remove @Usuário'],
      'Não é possível remover o abridor, o bot ou um membro da staff. Outros cargos do usuário ainda podem conceder acesso ao canal.',
      'Use dentro de um canal de ticket, como staff e com **Gerenciar Servidor**. O bot precisa de **Gerenciar Canais**, **Gerenciar Cargos** e acesso ao canal.',
    ),
    transfer: subcommandUsage(
      'Transferir atendimento',
      'Defina outro **membro da staff como responsável** pelo ticket atual e conceda acesso ao canal.',
      '`staff`: menção ou ID de um membro autorizado da equipe.',
      ['ticket transfer @Atendente'],
      'O destino deve estar no servidor e ser reconhecido como staff: cargo configurado, dono do servidor ou permissão **Gerenciar Canais**.',
      'Use dentro de um canal de ticket, como staff e com **Gerenciar Servidor**. O bot precisa de **Gerenciar Canais**, **Gerenciar Cargos** e acesso ao canal.',
    ),
    errors: {
      emptyPattern: 'O padrão de nome não pode estar vazio.',
      missingCategoryTarget: 'Informe `open` ou `closed` depois da categoria.',
      invalidCategoryTarget:
        'Tipo de categoria inválido. Use `open` ou `closed`.',
      invalidStaffAction:
        'Ação de cargo inválida. Use `add`, `remove` ou `list`.',
      invalidBlacklistAction:
        'Ação de bloqueio inválida. Use `add` ou `remove`.',
      missingOptionName: 'Informe o nome da opção depois da reação.',
      invalidOptionAction:
        'Ação de opção inválida. Use `add`, `remove` ou `list`.',
      invalidCloseAction:
        'Ação de fechamento inválida. Use `delete` ou `archive`.',
      invalidCloseDelay:
        'O atraso precisa ser um número inteiro entre 0 e 30 segundos.',
      invalidToggle: 'Valor inválido. Use `on` ou `off`.',
      invalidTicketReference:
        'Informe um número de ticket ou uma menção/ID de canal válido.',
      unexpectedArguments: (command: string) =>
        `\`${command}\` não aceita argumentos adicionais.`,
    },
    argumentsDescription: [
      '`channel` / `category`: menção ou ID do canal/categoria.',
      '`user` / `staff`: menção ou ID do membro.',
      '`role`: menção ou ID do cargo da equipe.',
      '`reaction` / `emoji`: emoji Unicode ou personalizado.',
      '`name`: nome da opção; até 40 caracteres.',
      '`number`: número do ticket.',
      '`seconds`: atraso entre 0 e 30 segundos.',
      '`pattern`: nome do canal com variáveis, como `ticket-{ticket.count}`.',
      '`motivo`: motivo opcional do fechamento.',
      '`--title ...`: configura o embed; aceita também `--description`, `--color`, `--image` e `--thumbnail`.',
    ].join('\n'),
    requirementsDescription: [
      'Quem usa o comando precisa de **Gerenciar Servidor**.',
      'O bot precisa de **Gerenciar Canais**, **Gerenciar Cargos**, acesso ao canal, envio de mensagens/embeds/arquivos, histórico, reações e **Gerenciar Mensagens**.',
      'As permissões dos canais e cargos devem permitir o acesso do bot.',
      'O painel precisa de opções para abrir tickets. Membros da blacklist não podem abrir.',
      'Fechar por reação depende da equipe ou da opção que permite ao autor fechar.',
    ].join('\n'),
  },
  feedback: (user: string, message: string) => `${user}, ${message}`,
  staffOnly: {
    title: 'Apenas staff',
    description:
      'Você precisa ser da staff ou ter a permissão **Gerenciar canais** para fazer isso.',
  },
  botPermissions: {
    title: 'Faltam permissões',
    description: (permissions: string) =>
      `Eu preciso das permissões ${permissions} para fazer isso. Ajuste as permissões do meu cargo e tente novamente.`,
  },
  notTicketChannel: {
    title: 'Este canal não é um ticket',
    description:
      'Use este comando dentro do canal de um ticket aberto ou arquivado.',
  },
  channel: {
    title: 'Canal definido',
    description: (id: string) =>
      `O canal <#${id}> foi definido como local do painel do ticket.`,
    notFound: 'O canal informado não existe neste servidor.',
    invalid: 'O canal informado não é um canal de texto.',
    cannotSend:
      'Não consigo enviar mensagens nesse canal. Verifique se eu tenho acesso e as permissões necessárias.',
  },
  category: {
    title: 'Categoria definida',
    openSaved: (name: string) =>
      `A categoria \`${name}\` foi definida para os tickets abertos.`,
    closedSaved: (name: string) =>
      `A categoria \`${name}\` foi definida para os tickets fechados.`,
    notFound: 'A categoria informada não foi encontrada neste servidor.',
    notCategory: 'O canal informado não é uma categoria.',
  },
  panel: {
    title: 'Painel atualizado',
    description: (prefix: string) =>
      `O painel do ticket foi atualizado com sucesso.\n\n-# \`${prefix}ticket panel update\` para atualizar a mensagem\n-# \`${prefix}ticket panel preview\` para visualizar a mensagem.`,
    tooLong: {
      title: 'Descrição muito longa',
      description: (max: number) =>
        `Depois de substituir \`{options}\`, a descrição do painel passou do limite de **${max}** caracteres. Reduza o texto e tente novamente.`,
    },
    preview: {
      notConfigured: {
        title: 'Nada foi configurado...',
        description: (prefix: string) =>
          `É impossível mostrar o nada... Por favor, configure a mensagem do painel usando \`${prefix}ticket panel\`.`,
      },
    },
    send: {
      notConfigured: {
        title: 'Nada foi configurado...',
        description: (prefix: string) =>
          `É impossível enviar o nada... Por favor, configure a mensagem do painel usando \`${prefix}ticket panel\`.`,
      },
      channelNotConfigured: {
        title: 'Canal não configurado',
        description: (prefix: string) =>
          `O canal do painel de tickets não foi configurado. Use \`${prefix}ticket channel <#channel|id>\` para configurar.`,
      },
      failed: {
        title: 'Não foi possível enviar o painel',
        description: (channelId: string) =>
          `Não consegui enviar a mensagem em <#${channelId}>. Verifique se o canal ainda existe e se eu tenho permissão para ver o canal, enviar mensagens, inserir links e adicionar reações.`,
      },
      success: {
        title: 'Painel enviado',
        description: (guildId: string, channelId: string, messageId: string) =>
          `O painel foi enviado com sucesso! Confira a mensagem em https://web.fluxer.app/channels/${guildId}/${channelId}/${messageId}`,
      },
    },
    update: {
      notConfigured: {
        title: 'Nada foi configurado...',
        description: (prefix: string) =>
          `É impossível atualizar com o nada... Por favor, configure a mensagem do painel usando \`${prefix}ticket panel\`.`,
      },
      notSent: {
        title: 'Painel ainda não foi enviado',
        description: (prefix: string) =>
          `Não há nenhum painel enviado para atualizar. Use \`${prefix}ticket panel send\` primeiro.`,
      },
      messageNotFound: {
        title: 'Mensagem do painel não encontrada',
        description: (channelId: string, prefix: string) =>
          `Não encontrei o painel em <#${channelId}>. Ele pode ter sido apagado. Use \`${prefix}ticket panel send\` para enviar de novo.`,
      },
      failed: {
        title: 'Não foi possível atualizar o painel',
        description: (channelId: string) =>
          `Não consegui editar o painel em <#${channelId}>. Verifique se eu ainda tenho acesso ao canal.`,
      },
      success: {
        title: 'Painel atualizado',
        description: (guildId: string, channelId: string, messageId: string) =>
          `O painel foi atualizado com sucesso! Confira a mensagem em https://web.fluxer.app/channels/${guildId}/${channelId}/${messageId}`,
      },
    },
  },
  option: {
    invalidEmoji:
      'Não reconheci essa reação. Use um emoji padrão, como 💡, ou um emoji personalizado.',
    nameTooLong: (max: number) =>
      `O nome da opção pode ter no máximo **${max}** caracteres.`,
    alreadyExists: (emoji: string) =>
      `Já existe uma opção com a reação ${emoji}.`,
    limitReached: (max: number) =>
      `O painel aceita no máximo **${max}** opções.`,
    notFound: (emoji: string) =>
      `Não existe nenhuma opção com a reação ${emoji}.`,
    add: {
      title: 'Opção adicionada',
      description: (emoji: string, name: string) =>
        `A opção ${emoji} **${name}** foi adicionada ao painel.`,
    },
    remove: {
      title: 'Opção removida',
      description: (emoji: string, name: string) =>
        `A opção ${emoji} **${name}** foi removida do painel.`,
    },
    list: {
      title: 'Opções do painel',
      count: (count: number) =>
        `Este painel tem **${count}** ${count === 1 ? 'opção' : 'opções'} configurada${count === 1 ? '' : 's'}.`,
      line: (emoji: string, name: string) => `- ${emoji} **${name}**`,
      empty: 'Nenhuma opção foi configurada ainda.',
    },
    panelSync: {
      ok: '-# O painel que já foi enviado foi atualizado.',
      notSent: (prefix: string) =>
        `-# Ela aparecerá no painel quando você enviá-lo com \`${prefix}ticket panel send\`.`,
      tooLong:
        '-# Não consegui atualizar o painel porque a descrição ficou muito longa depois da lista de opções.',
      failed: (prefix: string) =>
        `-# Não consegui atualizar a mensagem do painel. Use \`${prefix}ticket panel send\` para enviá-lo de novo.`,
    },
  },
  close: {
    action: {
      title: 'Ação de fechamento definida',
      delete: 'Ação definida: **apagar o canal** ao fechar o ticket.',
      archive:
        'Ação definida: **arquivar o canal** ao fechar o ticket. O abridor e os usuários adicionados perdem o acesso.',
    },
    delay: {
      title: 'Tempo de fechamento definido',
      saved: (seconds: number) =>
        `O ticket será fechado **${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}** depois do clique em fechar.`,
    },
    emoji: {
      title: 'Emoji de fechamento definido',
      saved: (emoji: string) =>
        `A reação ${emoji} será usada para fechar os tickets.`,
    },
    opener: {
      title: 'Permissão de fechamento definida',
      enabled: 'O abridor agora pode fechar o próprio ticket.',
      disabled:
        'O abridor só pode fechar tickets se também tiver autorização independente de staff ou administração.',
    },
    dm: {
      title: 'Aviso por DM definido',
      enabled: 'O abridor receberá uma DM quando o ticket for fechado.',
      disabled: 'O abridor não receberá DM quando o ticket for fechado.',
    },
    notOpen: {
      title: 'Ticket já está fechado',
      description:
        'Este ticket já foi arquivado. Use `ticket reopen` para reabri-lo.',
    },
    onlyStaff: {
      title: 'Fechamento restrito',
      description:
        'você não pode fechar este ticket. Apenas membros com permissão podem realizar essa ação.',
    },
    alreadyClosing: {
      title: 'Fechamento em andamento',
      description: 'Este ticket já está sendo fechado. Aguarde um instante.',
    },
    alreadyClosed: {
      title: 'Ticket fechado',
      description: 'Este ticket já foi fechado.',
    },
    delayMessage: {
      title: 'Fechando o ticket',
      description: (seconds: number) =>
        `este ticket será fechado em **${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}**.`,
    },
    archived: {
      title: 'Ticket fechado',
      description: 'este ticket foi fechado com sucesso.',
    },
    reasonLine: (reason: string) => `**Motivo:** ${reason}`,
    deleteFailed: {
      title: 'Não foi possível apagar o ticket',
      description:
        'Não consegui apagar o canal do ticket. Confira se eu tenho a permissão **Gerenciar canais** e tente novamente.',
    },
  },
  closeDm: {
    title: 'Ticket fechado',
    description: (server: string) =>
      `Seu ticket em **${server}** foi fechado. Se precisar de ajuda novamente, abra um novo ticket pelo painel do servidor.`,
    ticket: (number: number, type: string) =>
      `**Ticket:** #${String(number).padStart(3, '0')} · ${type}`,
    closedBy: (userTag: string) => `**Fechado por:** ${userTag}`,
    openedAt: (timestamp: string) => `**Aberto em:** ${timestamp}`,
    closedAt: (timestamp: string) => `**Fechado em:** ${timestamp}`,
    duration: (duration: string) => `**Tempo aberto:** ${duration}`,
    reason: (reason: string) => `**Motivo:** ${reason}`,
    footer:
      'Esta mensagem foi enviada porque você abriu um ticket neste servidor.',
    unknownServer: 'servidor desconhecido',
    unknownType: 'sem tipo',
    unknownUser: 'desconhecido',
  },
  reopen: {
    notFound: {
      title: 'Ticket não encontrado',
      description:
        'Não encontrei nenhum ticket com esse número ou canal. Se o ticket foi apagado, não é possível reabri-lo.',
    },
    alreadyOpen: {
      title: 'Ticket já está aberto',
      description: 'Este ticket já está aberto e não precisa ser reaberto.',
    },
    channelMissing: {
      title: 'Canal do ticket não existe',
      description:
        'O canal deste ticket foi apagado, então não é possível reabri-lo.',
    },
    notice: {
      title: 'Ticket reaberto',
      description: (user: string) =>
        `o ticket de ${user} foi reaberto. A staff está disponível para ajudar.`,
    },
    otherOpen: (user: string, staffRoles: string) =>
      `-# ${user} já tem outro ticket aberto. A staff decidiu reabrir este mesmo assim. ${staffRoles}`.trimEnd(),
    success: {
      title: 'Ticket reaberto',
      description: (number: number) =>
        `O ticket **#${String(number).padStart(3, '0')}** foi reaberto com sucesso.`,
    },
  },
  add: {
    title: 'Usuário adicionado',
    success: (user: string) =>
      `o usuário ${user} foi adicionado ao ticket com sucesso.`,
    notMember:
      'O usuário informado não está no servidor. Por favor, informe um membro válido.',
  },
  remove: {
    title: 'Usuário removido',
    success: (user: string) =>
      `o usuário ${user} foi removido do ticket com sucesso.`,
    opener: 'Não é possível remover o acesso do abridor do ticket.',
    bot: 'Não é possível remover o meu próprio acesso do ticket.',
    staff: 'Não é possível remover o acesso de um membro da staff do ticket.',
  },
  transfer: {
    title: 'Ticket transferido',
    success: (user: string) =>
      `o ticket foi transferido para ${user} com sucesso.`,
    notice: {
      title: 'Ticket transferido',
      description: (user: string) =>
        `${user} agora é o responsável por este ticket.`,
    },
    notMember:
      'O staff informado não está no servidor. Por favor, informe um membro válido.',
    notStaff:
      'O usuário informado não é da staff. Escolha alguém com um cargo de staff ou com a permissão **Gerenciar canais**.',
  },
  staffrole: {
    list: {
      title: 'Cargos de staff configurados',
      count: (count: number) =>
        `Este servidor tem **${count}** ${count === 1 ? 'cargo' : 'cargos'} de staff configurado${count === 1 ? '' : 's'}.`,
      line: (role: string, id: string, name: string) =>
        `- ${role} **${name}** (\`${id}\`)`,
      empty: 'Nenhum cargo de staff foi configurado ainda.',
    },
    title: 'Cargos de staff atualizados',
    added: (role: string) =>
      `O cargo ${role} agora faz parte da staff dos tickets.`,
    removed: (role: string) =>
      `O cargo ${role} não faz mais parte da staff dos tickets.`,
    alreadyAdded: (role: string) =>
      `O cargo ${role} já está configurado como staff.`,
    notFound: 'O cargo informado não existe neste servidor.',
    notFoundRole: (role: string) =>
      `O cargo ${role} não está configurado como staff.`,
    limit: (max: number) =>
      `Você pode configurar no máximo **${max}** cargos de staff.`,
  },
  logchannel: {
    title: 'Canal de logs definido',
    description: (id: string) =>
      `O canal <#${id}> receberá os logs de abertura, fechamento e reabertura de tickets.`,
  },
  namepattern: {
    title: 'Padrão de nome definido',
    saved: (pattern: string) =>
      `O padrão de nome dos canais de ticket agora é \`${pattern}\`.`,
    tooLong: (max: number) =>
      `O padrão de nome pode ter no máximo **${max}** unidades UTF-16.`,
    unknown: (variables: string, valid: string) =>
      `Variável desconhecida: ${variables}. As variáveis válidas são: ${valid}.`,
  },
  welcome: {
    preview: {
      exampleType: 'Exemplo de tipo',
      defaultNote: (prefix: string) =>
        `-# Esta é a embed padrão. Use \`${prefix}ticket welcome ...\` para personalizá-la.`,
    },
    title: 'Embed de boas-vindas atualizada',
    saved: (prefix: string, unknown: string) =>
      `A embed de boas-vindas foi atualizada. Ela será usada nos próximos tickets.${
        unknown
          ? `\n\n-# Variáveis desconhecidas: ${unknown}. Elas serão mantidas como estão no texto.`
          : ''
      }\n\nPara editá-la novamente, use \`${prefix}ticket welcome ...\`.`,
    default: {
      title: 'Ticket aberto',
      description:
        'Olá, {user.mention}! Seu ticket de **{ticket.type}** foi aberto com o número **#{ticket.number}**.\n\nDescreva sua solicitação com o máximo de detalhes possível. A staff responderá em breve.\n\n-# Para fechar o ticket, reaja com {close.emoji}.',
    },
  },
  blacklist: {
    title: 'Lista de bloqueio atualizada',
    added: (user: string) =>
      `${user} não pode mais abrir tickets neste servidor.`,
    removed: (user: string) => `${user} pode abrir tickets novamente.`,
    alreadyAdded: (user: string) => `${user} já está na lista de bloqueio.`,
    notFound: (user: string) => `${user} não está na lista de bloqueio.`,
    notMember:
      'O usuário informado não está no servidor. Por favor, informe um membro válido.',
    limit: (max: number) =>
      `A lista de bloqueio aceita no máximo **${max}** usuários.`,
  },
  config: {
    title: 'Configuração do sistema de tickets',
    notConfigured: 'não configurado',
    yes: 'sim',
    no: 'não',
    panelChannel: (channel: string) => `**Canal do painel:** ${channel}`,
    panelMessage: (message: string) => `**Painel enviado:** ${message}`,
    panelSent: (url: string) => `[ver mensagem](${url})`,
    panelNotSent: 'ainda não enviado',
    openCategory: (category: string) =>
      `**Categoria dos abertos:** ${category}`,
    closedCategory: (category: string) =>
      `**Categoria dos fechados:** ${category}`,
    closeAction: (action: string) => `**Ação ao fechar:** ${action}`,
    closeActionDelete: 'apagar o canal',
    closeActionArchive: 'arquivar o canal',
    closeDelay: (seconds: number) =>
      `**Espera ao fechar:** ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`,
    closeEmoji: (emoji: string) => `**Emoji de fechar:** ${emoji}`,
    openerCanClose: (value: string) => `**Abridor pode fechar:** ${value}`,
    closeDm: (value: string) => `**Aviso por DM ao fechar:** ${value}`,
    optionCount: (count: number) => `**Opções do painel:** ${count}`,
    staffRoles: (roles: string) => `**Cargos de staff:** ${roles}`,
    logChannel: (channel: string) => `**Canal de logs:** ${channel}`,
    namePattern: (pattern: string) => `**Padrão de nome:** \`${pattern}\``,
    welcome: (value: string) => `**Embed de boas-vindas:** ${value}`,
    blacklist: (count: number) => `**Usuários bloqueados:** ${count}`,
  },
  open: {
    created: (channelId: string) =>
      `seu ticket foi criado com sucesso! Acesse o canal <#${channelId}> para continuar seu atendimento.`,
    blacklisted: {
      title: 'Ticket bloqueado',
      description: 'Você está bloqueado de abrir tickets neste servidor.',
    },
    alreadyOpen: {
      title: 'Ticket já aberto',
      description: (channelId: string) =>
        `você já possui um ticket aberto! Continue seu atendimento no canal <#${channelId}>.`,
    },
    optionGone: {
      title: 'Opção indisponível',
      description: 'este tipo de ticket não está disponível no momento.',
    },
    brokenCategory: {
      title: 'Categoria inválida',
      description:
        'Não consegui abrir o ticket porque a categoria configurada não existe mais ou não é uma categoria. Reconfigure com `ticket category`.',
    },
    memberNotFound: {
      title: 'Membro não encontrado',
      description:
        'Não consegui abrir o ticket porque não encontrei os dados do membro no servidor.',
    },
    failedNotice: {
      title: 'Falha ao abrir ticket',
      description:
        'não foi possível criar seu ticket. Tente novamente mais tarde.',
    },
  },
  action: {
    failed: 'não foi possível realizar esta ação. Tente novamente mais tarde.',
    botPermissions: (permissions: string) =>
      `Não consegui executar a ação porque me faltam as permissões ${permissions}.`,
  },
  log: {
    open: {
      title: 'Ticket aberto',
      number: (number: number) =>
        `**Número:** #${String(number).padStart(3, '0')}`,
      channel: (channelId: string) => `**Canal:** <#${channelId}>`,
      opener: (userTag: string) => `**Aberto por:** ${userTag}`,
      type: (name: string) => `**Tipo:** ${name}`,
    },
    openFailed: {
      title: 'Falha ao abrir ticket',
      description:
        'Uma tentativa de abrir ticket falhou. Verifique as permissões do bot e a configuração do sistema.',
    },
    close: {
      title: 'Ticket fechado',
      number: (number: number) =>
        `**Número:** #${String(number).padStart(3, '0')}`,
      channel: (channelId: string) => `**Canal:** <#${channelId}>`,
      opener: (userTag: string) => `**Aberto por:** ${userTag}`,
      closedBy: (userTag: string) => `**Fechado por:** ${userTag}`,
      type: (name: string) => `**Tipo:** ${name}`,
      action: (action: string) => `**Ação:** ${action}`,
      reason: (reason: string) => `**Motivo:** ${reason}`,
    },
    reopen: {
      title: 'Ticket reaberto',
      number: (number: number) =>
        `**Número:** #${String(number).padStart(3, '0')}`,
      channel: (channelId: string) => `**Canal:** <#${channelId}>`,
      opener: (userTag: string) => `**Aberto por:** ${userTag}`,
      by: (userTag: string) => `**Reaberto por:** ${userTag}`,
    },
    transfer: {
      title: 'Ticket transferido',
      number: (number: number) =>
        `**Número:** #${String(number).padStart(3, '0')}`,
      channel: (channelId: string) => `**Canal:** <#${channelId}>`,
      from: (userTag: string) => `**Transferido por:** ${userTag}`,
      to: (userTag: string) => `**Novo responsável:** ${userTag}`,
    },
  },
}
