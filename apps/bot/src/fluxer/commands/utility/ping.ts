import { EmbedBuilder } from '@fluxerjs/core'
import { createCommand } from '#bot/fluxer'
import { colors, images } from '#bot/utils/constants'

export default createCommand({
  name: 'ping',
  description: "Shows the bot's latency.",
  descriptionLocalizations: {
    'pt-BR': 'Mostra a latência do bot.',
    'es-ES': 'Muestra la latencia del bot.',
  },
  aliases: ['ms', 'pong', 'latency'],
  category: 'utility',
  usage: '{prefix}ping',
  async run(ctx) {
    const { client } = ctx
    const start = Date.now()

    const embed = () =>
      new EmbedBuilder()
        .setTitle(`🏓 Pong!`)
        .setDescription(
          [
            `Gateway Ping: \`${client.ws.ping}ms\``,
            `Response Time: \`...ms\``,
          ].join('\n'),
        )
        .setTimestamp()
        .setColor(colors.primary)
        .setThumbnail(client.user?.avatarURL() ?? images.defaultAvatar)

    const reply = await ctx.reply({
      embeds: [embed()],
    })

    const end = Date.now()

    await reply.edit({
      embeds: [
        embed()
          .setTitle(`🏓 Pong!`)
          .setDescription(
            [
              `Gateway Ping: \`${client.ws.ping}ms\``,
              `Response Ping: \`${end - start}ms\``,
            ].join('\n'),
          )
          .setTimestamp()
          .setColor(colors.primary)
          .setThumbnail(client.user?.avatarURL() ?? images.defaultAvatar),
      ],
    })
  },
})
