import { createCommand } from '#bot/fluxer'
import { colors } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'

const USAGE = '{prefix}serverbanner'

export default createCommand({
  name: 'serverbanner',
  description: "Shows the server's banner.",
  descriptionLocalizations: {
    'pt-BR': 'Mostra o banner do servidor.',
    'es-ES': 'Muestra el banner del servidor.',
  },
  category: 'utility',
  usage: USAGE,
  aliases: ['sbanner'],
  guildOnly: true,
  async run(ctx) {
    const { t, author, client, guildId } = ctx

    if (!guildId) return

    const guild = await client.guilds.fetch(guildId).catch(() => null)
    if (!guild) {
      await ctx.reply({
        content: t('commands.serverbanner.notFound')
      })
      return
    }

    const animated = guild.banner?.startsWith('a_') ?? false
    const baseBannerUrl = guild.bannerURL({ size: 1024 })
    const bannerUrl =
      baseBannerUrl && animated
        ? baseBannerUrl.replace(/\.png(\?|$)/, '.gif$1')
        : baseBannerUrl

    if (!bannerUrl) {
      await ctx.reply({
        content: t('commands.serverbanner.noBanner')
      })
      return
    }

    const embed = Embed({
      title: t('commands.serverbanner.title', guild.name),
      color: colors.primary,
      image: bannerUrl,
      footer: {
        text: `ID: ${guild.id}`,
      },
    })

    embed.setDescription(t('commands.serverbanner.openInBrowser', bannerUrl))

    await ctx.reply({
      embeds: [embed],
      allowedMentions: {
        parse: [],
        users: [author.id],
        roles: [],
        repliedUser: true,
      },
    })
  },
})