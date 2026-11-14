import { config } from "#bot/utils/config";
import { emojis } from "#bot/utils/constants";

export default {
  title: 'Informações do Cargo',
  invalidusage: `${emojis.error} ${config.separator} Para utilizar esse comando, vocé precisa **informar um cargo** ou o **ID do cargo** para que eu possa pegar suas informações.`,
  notFound: `${emojis.error} ${config.separator} Me desculpe! Eu **não consegui** encontrar esse cargo. Por favor, informe um cargo que exista nesse servidor.`,
  invalidRole: `${emojis.error} ${config.separator} O cargo que vocé informou é **inválido**. Por favor, informe um cargo válido.`,
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