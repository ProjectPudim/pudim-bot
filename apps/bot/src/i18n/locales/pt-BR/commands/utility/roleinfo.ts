import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  messages: {
    invalidusage: `${emojis.error} ${config.separator} Para utilizar esse comando, vocé precisa **informar um cargo** ou o **ID do cargo** para que eu possa pegar suas informações.`,
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
