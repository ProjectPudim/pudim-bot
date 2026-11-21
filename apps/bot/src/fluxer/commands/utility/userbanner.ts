import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import {
  Embed,
  getUserBannerUrl,
  parseUserId,
  resolveUser,
  safeReplyMentions,
} from '#bot/utils'
import { fetchFluxerProfile } from '#bot/utils/fluxer-profile'

export default createCommand({
  name: 'userbanner',
  description: "Shows a user's banner.",
  descriptionLocalizations: {
    'pt-BR': 'Mostra o banner de um usuário.',
    'es-ES': 'Muestra el banner de un usuario.',
  },
  category: Category.Utilities,
  usage: '{prefix}userbanner [@user|id]',
  aliases: ['banner'],
  async run(ctx) {
    const { t, args, author, client } = ctx
    const raw = args[0]?.trim()
    const targetId = raw ? parseUserId(raw) : author.id

    if (!targetId) {
      await ctx.reply({
        content: t('common.invalid.messages.user'),
      })
      return
    }

    const [user, apiProfile] = await Promise.all([
      resolveUser(client, targetId, author),
      fetchFluxerProfile(targetId),
    ])

    if (!user && !apiProfile) {
      await ctx.reply({
        content: t('common.notFound.messages.user', raw || targetId),
      })
      return
    }

    const bannerUrl = getUserBannerUrl(targetId, user, apiProfile, 1024)
    if (!bannerUrl) {
      await ctx.reply({
        content: t('commands.userbanner.messages.noBanner', targetId),
      })
      return
    }

    const username = user?.username ?? apiProfile?.username ?? targetId
    const embed = Embed({
      title: t('commands.userbanner.title', username),
      description: t('commands.userbanner.openInBrowser', bannerUrl),
      color: colors.primary,
      image: bannerUrl,
      footer: { text: `ID: ${targetId}` },
    })

    await ctx.reply({
      embeds: [embed],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
