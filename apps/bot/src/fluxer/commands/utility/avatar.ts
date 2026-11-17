import { Category } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import {
  Embed,
  getUserAvatarUrl,
  parseUserId,
  resolveUser,
  safeReplyMentions,
} from '#bot/utils'

export default createCommand({
  name: 'avatar',
  description: 'Shows the avatar of a Fluxer user.',
  aliases: ['pfp', 'useravatar'],
  descriptionLocalizations: {
    'pt-BR': 'Mostra o avatar de um usuário do Fluxer.',
    'es-ES': 'Muestra el avatar de un usuario del Fluxer.',
  },
  category: Category.Utilities,
  usage: '{prefix}avatar [user]',
  async run(ctx) {
    const { args, t, client, author } = ctx
    const raw = args[0]?.trim()
    const targetId = raw ? parseUserId(raw) : author.id

    if (!targetId) {
      await ctx.reply({
        content: t('common.invalid.messages.user'),
      })
      return
    }

    const user = await resolveUser(client, targetId, author)
    if (!user) {
      await ctx.reply({
        content: t('common.notFound.messages.user', raw ?? targetId),
      })
      return
    }

    const avatarUrl = getUserAvatarUrl(user, { size: 512 })
    const embed = Embed({
      title: t('commands.avatar.title', user.username),
      description: avatarUrl
        ? t('commands.avatar.openInBrowser', avatarUrl)
        : t('commands.avatar.noAvatar'),
      image: avatarUrl ?? undefined,
      footer: {
        text:
          author.id === targetId
            ? t('commands.avatar.avatarSelf')
            : `ID: ${targetId}`,
      },
    })

    await ctx.reply({
      embeds: [embed],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
