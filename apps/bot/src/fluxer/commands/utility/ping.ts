import { Category, colors, images } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { Embed } from '#bot/utils'

export default createCommand({
  name: 'ping',
  description: "Shows the bot's latency.",
  descriptionLocalizations: {
    'pt-BR': 'Mostra a latência do bot.',
    'es-ES': 'Muestra la latencia del bot.',
  },
  aliases: ['ms', 'pong', 'latency'],
  category: Category.Utilities,
  usage: '{prefix}ping',
  async run(ctx) {
    const { client, t } = ctx
    const thumbnail = client.user?.avatarURL() ?? images.defaultAvatar

    const buildEmbed = (responseMs: number | string) =>
      Embed({
        title: t('commands.ping.title'),
        description: [
          t('commands.ping.gateway', client.ws.ping),
          t('commands.ping.response', responseMs),
        ],
        color: colors.primary,
        thumbnail,
        timestamp: true,
      })

    const start = Date.now()
    const reply = await ctx.reply({ embeds: [buildEmbed('...')] })
    const elapsed = Date.now() - start

    await reply.edit({ embeds: [buildEmbed(elapsed)] })
  },
})
