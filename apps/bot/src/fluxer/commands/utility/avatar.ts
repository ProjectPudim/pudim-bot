import type { User } from '@fluxerjs/core'
import { createCommand } from '#bot/fluxer'
import { Embed } from '#bot/utils/embed'
import { parseTargetId } from '#bot/utils/user'

export default createCommand({
  name: 'avatar',
  description: 'Shows the avatar of a Fluxer user',
  aliases: ['pfp', 'useravatar'],
  descriptionLocalizations: {
    'pt-BR': 'Mostra o avatar de um usuário do Fluxer',
    'es-ES': 'Muestra el avatar de un usuario del Fluxer',
  },
  category: 'utility',
  usage: '{prefix}avatar [user]',
  async run(ctx) {
    const { args, t, client, author } = ctx

    const raw = args[0]?.trim()
    const targetId = raw ? parseTargetId(raw) : author.id
    if (!targetId) {
      await ctx.reply({
        content: t('common.invalid.user'),
      })
      return
    }
    const user: User | null =
      targetId === author.id
        ? author
        : await client.users.fetch(targetId).catch(() => null)

    if (!user) {
      await ctx.reply({
        content: t('common.notFound.user', raw ?? targetId),
      })
      return
    }

    const animated = user.avatar?.startsWith('a_') ?? false
    const avatarUrl = user.avatar
      ? (user.avatarURL({
          size: 512,
          extension: animated ? 'gif' : 'png',
        }) ?? null)
      : null

    const embed = Embed({
      title: t('commands.avatar.title', user.username),
      footer: {
        text:
          author.id === targetId
            ? t('commands.avatar.avatarSelf')
            : `ID: ${targetId}`,
      },
    })

    if (avatarUrl) {
      embed.setDescription(t('commands.avatar.openInBrowser', avatarUrl))
      embed.setImage(avatarUrl)
    } else {
      embed.setDescription(t('commands.avatar.noAvatar'))
    }

    await ctx.reply({
      embeds: [embed],
    })
    return
  },
})
