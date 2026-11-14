import { createCommand } from '#bot/fluxer'
import { fetchFluxerProfile } from '#bot/utils/apis/felipw'
import { colors } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'
import { parseTargetId } from '#bot/utils/user'

const USAGE = '{prefix}userbanner [@user|id]'

export default createCommand({
  name: 'userbanner',
  description: "Shows a user's banner.",
  descriptionLocalizations: {
    'pt-BR': 'Mostra o banner de um usuário.',
    'es-ES': 'Muestra el banner de un usuario.',
  },
  category: 'utility',
  usage: USAGE,
  aliases: ['banner'],
  async run(ctx) {
    const { t, args, author, client } = ctx

    let targetId = parseTargetId(args[0])
    if (args[0] && !targetId) {
      await ctx.reply({
        content: t('common.invalid.user'),
      })
      return
    }
    if (!targetId) targetId = author.id

    const user =
      targetId === author.id
        ? author
        : await client.users.fetch(targetId).catch(() => null)

    if (!user && targetId !== author.id) {
      // Still allow API fallback below.
    }

    const apiProfile = await fetchFluxerProfile(targetId)

    const username = user?.username ?? apiProfile?.username ?? targetId

    const animated =
      (user?.banner ?? apiProfile?.profile?.banner)?.startsWith('a_') ?? false
    const bannerUrl = user?.banner
      ? (user.bannerURL({
          size: 1024,
          extension: animated ? 'gif' : 'png',
        }) ?? null)
      : (apiProfile?.profile?.bannerUrl ??
        (apiProfile?.profile?.banner
          ? `https://fluxerusercontent.com/banners/${targetId}/${apiProfile.profile.banner}.${animated ? 'gif' : 'png'}?size=1024`
          : null))

    if (!user && !apiProfile) {
      await ctx.reply({
        content: t('common.notFound.user', args[0]?.trim() || targetId),
      })
      return
    }

    if (!bannerUrl) {
      await ctx.reply({
        content: t('commands.userbanner.noBanner', targetId),
      })
      return
    }

    const embed = Embed({
      title: t('commands.userbanner.title', username),
      color: colors.primary,
      image: bannerUrl,
      footer: {
        text: `ID: ${targetId}`,
      },
    })

    embed.setDescription(t('commands.userbanner.openInBrowser', bannerUrl))

    await ctx.reply({
      embeds: [embed],
    })
  },
})
