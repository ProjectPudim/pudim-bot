import { Category, emojis } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { Embed, getBotStats, toUnixTimestamp } from '#bot/utils'

const BYTES_PER_MB = 1024 * 1024

export default createCommand({
  name: 'botinfo',
  description: 'Shows information about the bot.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre o bot.',
    'es-ES': 'Muestra información sobre el bot.',
  },
  category: Category.Utilities,
  usage: '{prefix}botinfo',
  aliases: ['pudim', 'pudiminfo'],
  async run(ctx) {
    const { client, t } = ctx
    const botUser = client.user!

    const heapMb = (process.memoryUsage().heapUsed / BYTES_PER_MB).toFixed(2)
    const startedAt = Math.floor((Date.now() - (client.uptime ?? 0)) / 1000)
    const createdAt = toUnixTimestamp(botUser.createdAt) ?? startedAt
    const botAvatar = botUser.displayAvatarURL()
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
            `> **${t('commands.botinfo.fields.technical.memory')}:** ${heapMb} MB`,
          ],
          inline: true,
        },
        {
          name: `${emojis.microchip} ${t('commands.botinfo.fields.technologies.name')}:`,
          value: [
            `> **${t('commands.botinfo.fields.technologies.language')}:** ${emojis.typescript} TypeScript`,
            `> **${t('commands.botinfo.fields.technologies.database')}:** ${emojis.mongodb} MongoDB`,
          ],
          inline: true,
        },
      ],
      thumbnail: botAvatar,
    })

    await ctx.reply({ embeds: [embed] })
  },
})
