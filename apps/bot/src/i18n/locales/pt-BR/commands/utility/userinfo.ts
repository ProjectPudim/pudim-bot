import { config } from "#bot/utils/config";
import { emojis } from "#bot/utils/constants";

export default {
  userTitle: 'Informações do Usuário',
  memberTitle: 'Informações do Membro',
  userNotFound:
    `${emojis.error} ${config.separator} Me desculpe! Eu **não consegui** encontrar esse usuário. Por favor, informe um usuário que exista.`,
  invalidUser: `${emojis.error} ${config.separator} O usuário que vocé informou é **inválido**. Por favor, informe um usuário válido.`,
  labels: {
    username: 'Usuário',
    displayName: 'Nome de exibição',
    id: 'ID',
    accountType: 'Tipo de conta',
    created: 'Criada em',
    badges: 'Insígnias',
    bio: 'Sobre o usuário',
    connections: 'Conexões',
    avatar: 'Avatar',
    banner: 'Banner',
    joined: 'Entrou em',
    nickname: 'Apelido no servidor',
    roles: 'Cargos',
    highestRole: 'Cargo mais alto',
    timeout: 'Mutado até',
    noRoles: 'Nenhum cargo',
  },
  accountType: {
    bot: 'Conta de Bot',
    user: 'Conta de usuário',
  },
  links: {
    avatar: (url: string) => `[Avatar do Usuário](${url})`,
    banner: (url: string) => `[Banner do Usuário](${url})`,
  },
  facts: {
    title: 'Curiosidades',
    nickname: (nick: string) =>
      `- O apelido dele é **${nick}** neste servidor.`,
    highestRole: (role: string) =>
      `- O cargo mais alto dele é ${role} neste servidor.`,
    timeout: (timestamp: number) =>
      `- O membro está mutado até <t:${timestamp}:f> (<t:${timestamp}:R>).`,
  },
}