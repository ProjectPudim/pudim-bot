import { AttachmentBuilder, type User } from '@fluxerjs/core'
import { createCommand } from '#bot/fluxer'
import { generateShipImage } from '#bot/utils/canvas/ship'
import { images } from '#bot/utils/constants'
import { parseTargetId } from '#bot/utils/user'

const USAGE = '{prefix}ship <@user|id> [@user|id]'

function getShipName(name1: string, name2: string): string {
  const first = name1.trim()
  const second = name2.trim()
  if (!first) return second
  if (!second) return first

  const part1 = first.slice(0, Math.ceil(first.length / 2))
  const part2 = second.slice(Math.floor(second.length / 2))

  return (part1 + part2).trim() || `${first}${second}`
}

function avatarUrl(user: User): string {
  if (!user.avatar) return images.defaultAvatar
  const animated = user.avatar.startsWith('a_')
  return (
    user.avatarURL({
      size: 512,
      extension: animated ? 'gif' : 'png',
    }) ?? images.defaultAvatar
  )
}

function messageKey(percentage: number, sameUser: boolean): string {
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
  category: 'fun',
  usage: USAGE,
  aliases: ['shipname'],
  async run(ctx) {
    const { t, args, author, client } = ctx

    const firstId = parseTargetId(args[0])
    if (!firstId) {
      await ctx.reply({
        content: t('commands.ship.invalidUsage', ctx.prefix),
      })
      return
    }

    const secondRaw = args[1]?.trim()
    let secondId = author.id
    if (secondRaw) {
      const parsedSecond = parseTargetId(secondRaw)
      if (!parsedSecond) {
        await ctx.reply({
          content: t('common.invalid.user'),
        })
        return
      }
      secondId = parsedSecond
    }

    const user1: User | null =
      firstId === author.id
        ? author
        : await client.users.fetch(firstId).catch(() => null)

    if (!user1) {
      await ctx.reply({
        content: t('common.notFound.user', args[0]?.trim() || firstId),
      })
      return
    }

    const user2: User | null =
      secondId === author.id
        ? author
        : secondId === firstId
          ? user1
          : await client.users.fetch(secondId).catch(() => null)

    if (!user2) {
      await ctx.reply({
        content: t('common.notFound.user', secondRaw || secondId),
      })
      return
    }

    const sameUser = user1.id === user2.id

    const percentage = sameUser
      ? 100
      : Number((BigInt(user1.id) + BigInt(user2.id)) % 101n)

    const shipName = getShipName(user1.username, user2.username)
    const translate = t as (key: string, ...args: unknown[]) => string
    const selectedMessage = translate(
      `commands.ship.messages.${messageKey(percentage, sameUser)}`,
    )

    const buffer = await generateShipImage(
      avatarUrl(user1),
      avatarUrl(user2),
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
      allowedMentions: {
        parse: [],
        users: [author.id],
        roles: [],
        repliedUser: true,
      },
    })
  },
})
