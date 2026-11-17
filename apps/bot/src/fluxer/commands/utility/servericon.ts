import { createCommand } from '#bot/fluxer'
import { colors } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'

const USAGE = '{prefix}servericon [guildId]'

export default createCommand({
  name: 'servericon',
  description: "Shows the server's icon.",
  descriptionLocalizations: {
    'pt-BR': 'Mostra o ícone do servidor.',
    'es-ES': 'Muestra el icono del servidor.',
  },
  category: 'utility',
  usage: USAGE,
  aliases: ['sicon'],
  guildOnly: true,
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

    const animated = guild.icon?.startsWith('a_') ?? false
    const baseIconUrl = guild.iconURL({ size: 512 })
    const iconUrl =
      baseIconUrl && animated
        ? baseIconUrl.replace(/\.png(\?|$)/, '.gif$1')
        : baseIconUrl

    if (!iconUrl) {
      await ctx.reply({
        content: t('commands.servericon.messages.noIcon', guild.id),
      })
      return
    }

    const embed = Embed({
      title: t('commands.servericon.title', guild.name),
      footer: {
        text: `ID: ${guild.id}`,
      },
      color: colors.primary,
    })

    embed.setDescription(t('commands.servericon.openInBrowser', iconUrl))
    embed.setImage(iconUrl)

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
