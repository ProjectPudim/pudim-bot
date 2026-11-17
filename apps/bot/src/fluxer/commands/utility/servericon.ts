import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { Embed, getGuildIconUrl, safeReplyMentions } from '#bot/utils'

export default createCommand({
  name: 'servericon',
  description: "Shows the server's icon.",
  descriptionLocalizations: {
    'pt-BR': 'Mostra o ícone do servidor.',
    'es-ES': 'Muestra el icono del servidor.',
  },
  category: Category.Utilities,
  usage: '{prefix}servericon [guildId]',
  aliases: ['sicon'],
  context: 'guild',
  async run(ctx) {
    const { t, args, author, client, guildId: currentGuildId } = ctx
    const targetGuildId = args[0]?.trim() || currentGuildId
    if (!targetGuildId) return

    const guild = await client.guilds.fetch(targetGuildId).catch(() => null)
    if (!guild) {
      await ctx.reply({
        content: t('common.notFound.messages.server', targetGuildId),
      })
      return
    }

    const iconUrl = getGuildIconUrl(guild, 512)
    if (!iconUrl) {
      await ctx.reply({
        content: t('commands.servericon.messages.noIcon', guild.id),
      })
      return
    }

    const embed = Embed({
      title: t('commands.servericon.title', guild.name),
      description: t('commands.servericon.openInBrowser', iconUrl),
      image: iconUrl,
      footer: { text: `ID: ${guild.id}` },
      color: colors.primary,
    })

    await ctx.reply({
      embeds: [embed],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
