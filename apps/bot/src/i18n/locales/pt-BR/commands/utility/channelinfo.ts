import { config, emojis } from '#bot/config'

export default {
  messages: {
    noAccess: `${emojis.error} ${config.separator} Me desculpe! Eu não consigo acessar o canal que você informou, por favor, informe um canal que eu tenha acesso.`,
  },
  title: 'Informações do Canal',

  labels: {
    name: 'Nome',
    id: 'ID',
    type: 'Tipo',
    created: 'Criado em',
    category: 'Categoria',
    topic: 'Tópico',
    nsfw: 'NSFW',
    slowmode: 'Modo lento',
    position: 'Posição',
    bitrate: 'Bitrate',
    userLimit: 'Limite de usuários',
    none: 'Nenhum',
    noCategory: 'Sem categoria',
    noTopic: 'Sem tópico',
  },

  types: {
    text: 'Canal de texto',
    voice: 'Canal de voz',
    category: 'Categoria',
    announcement: 'Canal de anúncios',
    announcementThread: 'Thread de anúncios',
    publicThread: 'Thread pública',
    privateThread: 'Thread privada',
    forum: 'Fórum',
    media: 'Mídia',
    link: 'Link',
    dm: 'Mensagem direta',
    groupDm: 'Grupo de mensagens diretas',
    personalNotes: 'Notas pessoais',
    unknown: 'Desconhecido',
  },

  values: {
    yes: 'Sim',
    no: 'Não',
    disabled: 'Desativado',
    unlimited: 'Ilimitado',
  },
}
