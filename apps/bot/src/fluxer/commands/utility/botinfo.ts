import { createCommand } from '#bot/fluxer'
import { getBotStats } from '#bot/utils/bot'
import { emojis } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'

export default createCommand({
  name: 'botinfo',
  description: 'Shows information about the bot.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre o bot.',
    'es-ES': 'Muestra información sobre el bot.',
  },
  category: 'utility',
  usage: '{prefix}botinfo',
  aliases: ['pudim', 'pudiminfo'],
  async run(ctx) {
    const { client, t } = ctx

    const { heapUsed } = process.memoryUsage()
    const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2)

    const startedAt = Math.floor((Date.now() - (client.uptime ?? 0)) / 1000)
    const createdAt = Math.floor(client.user!.createdAt.getTime() / 1000)

    const botAvatar = client.user!.displayAvatarURL()

    const { users, guilds } = getBotStats(client)

    const embed = Embed({
      author: { name: t('commands.botinfo.title'), iconUrl: botAvatar },
      description: t('commands.botinfo.description', client, users, guilds),
      fields: [
        {
          name: `${emojis.document} ${t('commands.botinfo.fields.technical.name')}:`,
          value: [
            `> **${t('commands.botinfo.fields.technical.createdAt')}** <t:${createdAt}:f>`,
            `> **${t('commands.botinfo.fields.technical.startedAt')}** <t:${startedAt}:R>`,
            `> **${t('commands.botinfo.fields.technical.memory')}:** ${toMB(heapUsed)} MB`,
          ].join('\n'),
          inline: true,
        },
        {
          name: `${emojis.microchip} ${t('commands.botinfo.fields.technologies.name')}:`,
          value: [
            `> **${t('commands.botinfo.fields.technologies.language')}:** ${emojis.typescript} TypeScript`,
            `> **${t('commands.botinfo.fields.technologies.database')}:** ${emojis.mongodb} MongoDB`,
          ].join('\n'),
          inline: true,
        },
      ],
      thumbnail: botAvatar,
    })

    await ctx.reply({ embeds: [embed] })
  },
})
