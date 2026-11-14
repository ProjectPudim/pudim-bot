import type { Client } from '@fluxerjs/core'

export default {
  title: 'Informações do Pudim',
  description: (client: Client, users: number, guilds: number) =>
    [
      `**Prazer, me chamo Pudim!** Eu sou um bot multifuncional feito para transformar sua comunidade em um lugar mais doce e funcional. Atualmente, estou em ajudando **${guilds.toLocaleString('pt-BR')} servidores** e divertindo **${users.toLocaleString('pt-BR')} usuários** com **${client.commands.filter((cmd) => !cmd.hidden).length} comandos**!`,
    ].join('\n'),
  fields: {
    technical: {
      name: 'Ficha técnica',
      createdAt: 'Criado em',
      startedAt: 'Ligado',
      memory: 'Memória',
    },
    technologies: {
      name: 'Tecnologias',
      language: 'Linguagem',
      database: 'Banco de Dados',
    },
  },
}
