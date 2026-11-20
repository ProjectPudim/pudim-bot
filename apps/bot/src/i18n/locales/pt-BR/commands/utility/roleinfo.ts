import { config, emojis } from '#bot/config'

export default {
  messages: {
    invalidUsage: `${config.separator(emojis.error)} Para utilizar esse comando, você precisa **informar um cargo** ou o **ID do cargo** para que eu possa pegar suas informações.`,
  },
  title: 'Informações do Cargo',
  noPermissions: 'Nenhuma permissão especial.',
  labels: {
    name: 'Nome',
    id: 'ID',
    color: 'Cor',
    position: 'Posição',
    created: 'Criado em',
    hoist: 'Exibido separadamente',
    mentionable: 'Mencionável',
    permissions: 'Permissões',
    noColor: 'Sem cor',
  },
  values: {
    yes: 'Sim',
    no: 'Não',
  },
}
