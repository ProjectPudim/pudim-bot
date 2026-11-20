import { config, emojis } from '#bot/config'

export default {
  title: 'Reações Automáticas',
  listTitle: 'Reações Automáticas',
  limitLine: (current: number, max: number) => `-# Limite: ${current}/${max}`,
  tableHeaders: {
    channel: 'Canal',
    reaction: 'Reação',
    type: 'Tipo de mensagem',
    ignore: 'Ignorar',
  },
  tableSeparator: '|---|---|---|---|',
  pageIndicator: (current: number, total: number) =>
    `-# Página ${current} de ${total}`,
  help: {
    description:
      'O **Auto Reaction** permite configurar reações que serão adicionadas automaticamente às mensagens de determinados canais, com filtros por tipo de conteúdo e opções para ignorar mensagens específicas.',
    commands: 'Comandos disponíveis',
    types: 'Tipos disponíveis',
    ignores: 'Filtros de ignore',
    limitLabel: 'Limite',
    limit: (max: number) =>
      `O servidor pode possuir até **${max} reações automáticas** no total, distribuídas entre seus canais.`,
    examples: 'Exemplos',
  },
  added: {
    all: (reaction: string, channel: string) =>
      `${config.separator(emojis.success)} A reação ${reaction} será adicionada em qualquer mensagem que for enviada no canal ${channel}.`,
    text: (reaction: string, channel: string) =>
      `${config.separator(emojis.success)} A reação ${reaction} será adicionada em mensagens que tiverem apenas texto no canal ${channel}.`,
    image: (reaction: string, channel: string) =>
      `${config.separator(emojis.success)} A reação ${reaction} será adicionada em mensagens que tiverem alguma imagem no canal ${channel}.`,
    video: (reaction: string, channel: string) =>
      `${config.separator(emojis.success)} A reação ${reaction} será adicionada em mensagens que tiverem algum vídeo no canal ${channel}.`,
    media: (reaction: string, channel: string) =>
      `${config.separator(emojis.success)} A reação ${reaction} será adicionada em mensagens que tiverem algum vídeo ou imagem no canal ${channel}.`,
    link: (reaction: string, channel: string) =>
      `${config.separator(emojis.success)} A reação ${reaction} será adicionada em mensagens que tiverem algum link no canal ${channel}.`,
    ignore: (filters: string) => `Mensagens de ${filters} serão ignoradas.`,
  },
  removed: {
    message: (reaction: string, channel: string) =>
      `${config.separator(emojis.success)} A reação ${reaction} não será mais adicionada no canal ${channel}.`,
  },
  cleared: {
    message: (count: number) =>
      `${config.separator(emojis.success)} Foram removidas ${count} configuração(ões) do canal.`,
  },
  listEmpty: 'Este servidor não possui reações automáticas configuradas.',
  invalidChannel: `${config.separator(emojis.error)} O canal informado não é válido ou não pertence a este servidor.`,
  invalidEmoji: `${config.separator(emojis.error)} O emoji informado não é válido.`,
  invalidType: `${config.separator(emojis.error)} O tipo informado não é válido.`,
  invalidIgnore: `${config.separator(emojis.error)} Um ou mais filtros informados não são válidos.`,
  duplicate: `${config.separator(emojis.error)} Essa configuração já existe neste canal.`,
  limitReached: (max: number) =>
    `${config.separator(emojis.error)} Este servidor já atingiu o limite de ${max} reações automáticas.`,
  notFound: `${config.separator(emojis.error)} Nenhuma configuração encontrada para essa reação.`,
  none: 'Nenhum',
  types: {
    all: 'Todas as mensagens',
    text: 'Textos',
    image: 'Imagens',
    video: 'Vídeos',
    media: 'Imagens e vídeos',
    link: 'Links',
  },
  ignores: {
    bots: 'bots',
    replies: 'respostas',
    webhooks: 'webhooks',
  },
  ignorePrefix: 'Ignorar',
  and: 'e',
}
