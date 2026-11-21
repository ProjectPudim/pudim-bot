import { AttachmentBuilder } from '@fluxerjs/core'
import { Category, images } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import {
  getUserAvatarUrl,
  parseUserId,
  resolveUser,
  safeReplyMentions,
} from '#bot/utils'
import { generateShipImage } from '#bot/utils/canvas/ship'

type ShipResultKey =
  | 'selfLove'
  | 'soulmates'
  | 'perfect'
  | 'potential'
  | 'friends'
  | 'low'
  | 'veryLow'

function createShipName(name1: string, name2: string): string {
  const first = name1.trim()
  const second = name2.trim()
  if (!first) return second
  if (!second) return first

  const part1 = first.slice(0, Math.ceil(first.length / 2))
  const part2 = second.slice(Math.floor(second.length / 2))
  return (part1 + part2).trim() || `${first}${second}`
}

function getShipResultKey(
  percentage: number,
  sameUser: boolean,
): ShipResultKey {
  if (sameUser) return 'selfLove'
  if (percentage === 100) return 'soulmates'
  if (percentage >= 91) return 'perfect'
  if (percentage >= 61) return 'potential'
  if (percentage >= 46) return 'friends'
  if (percentage >= 21) return 'low'
  return 'veryLow'
}

export default createCommand({
  name: 'ship',
  description: 'Ships two users.',
  descriptionLocalizations: {
    'pt-BR': 'Faz ship entre dois usuários.',
    'es-ES': 'Hace ship entre dos usuarios.',
  },
  category: Category.Fun,
  usage: '{prefix}ship <@user|id> [@user|id]',
  aliases: ['shipname'],
  cooldown: { duration: 5_000, scope: 'user' },
  async run(ctx) {
    const { t, args, author, client, prefix } = ctx

    const firstId = parseUserId(args[0])
    if (!firstId) {
      await ctx.reply({
        content: t('commands.ship.messages.invalidUsage', prefix),
      })
      return
    }

    const secondRaw = args[1]?.trim()
    let secondId = author.id
    if (secondRaw) {
      const parsedSecond = parseUserId(secondRaw)
      if (!parsedSecond) {
        await ctx.reply({
          content: t('common.invalid.messages.user'),
        })
        return
      }
      secondId = parsedSecond
    }

    const user1 = await resolveUser(client, firstId, author)
    if (!user1) {
      await ctx.reply({
        content: t('common.notFound.messages.user', args[0]?.trim() || firstId),
      })
      return
    }

    const user2 =
      secondId === firstId ? user1 : await resolveUser(client, secondId, author)
    if (!user2) {
      await ctx.reply({
        content: t('common.notFound.messages.user', secondRaw || secondId),
      })
      return
    }

    const sameUser = user1.id === user2.id
    const percentage = sameUser
      ? 100
      : Number((BigInt(user1.id) + BigInt(user2.id)) % 101n)

    const shipName = createShipName(user1.username, user2.username)
    const selectedMessage = t(
      `commands.ship.results.${getShipResultKey(percentage, sameUser)}`,
    )

    const buffer = await generateShipImage(
      getUserAvatarUrl(user1, { fallback: true }) ?? images.defaultAvatar,
      getUserAvatarUrl(user2, { fallback: true }) ?? images.defaultAvatar,
      percentage,
    )

    const attachment = new AttachmentBuilder(buffer, { name: 'ship.png' })
    const content = [
      `## ${t('commands.ship.title')}`,
      t('commands.ship.percentage', percentage),
      t('commands.ship.shipName', shipName),
      `- *"${selectedMessage}"* - Pudim`,
    ].join('\n')

    await ctx.reply({
      content,
      files: [attachment],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
