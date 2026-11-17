import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { Embed, getGuildBannerUrl, safeReplyMentions } from '#bot/utils'

export default createCommand({
  name: 'serverbanner',
  description: "Shows the server's banner.",
  descriptionLocalizations: {
    'pt-BR': 'Mostra o banner do servidor.',
    'es-ES': 'Muestra el banner del servidor.',
  },
  category: Category.Utilities,
  usage: '{prefix}serverbanner [guildId]',
  aliases: ['sbanner'],
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

    const bannerUrl = getGuildBannerUrl(guild, 1024)
    if (!bannerUrl) {
      await ctx.reply({
        content: t('commands.serverbanner.messages.noBanner', guild.id),
      })
      return
    }

    const embed = Embed({
      title: t('commands.serverbanner.title', guild.name),
      description: t('commands.serverbanner.openInBrowser', bannerUrl),
      color: colors.primary,
      image: bannerUrl,
      footer: { text: `ID: ${guild.id}` },
    })

    await ctx.reply({
      embeds: [embed],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
