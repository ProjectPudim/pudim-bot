import { Invite } from '@fluxerjs/core'
import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import {
  Embed,
  extractInviteCode,
  formatTimestampPair,
  formatUserTag,
  getSnapshotGuildIconUrl,
} from '#bot/utils'

export default createCommand({
  name: 'inviteinfo',
  description: 'Shows information about an invite.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre um convite.',
    'es-ES': 'Muestra información sobre una invitación.',
  },
  category: Category.Utilities,
  usage: '{prefix}inviteinfo <invite|code>',
  aliases: ['invite'],
  async run(ctx) {
    const { t, args, client, logger } = ctx
    const input = args.join(' ').trim()

    if (!input) {
      await ctx.reply({
        content: t('commands.inviteinfo.messages.invalidUsage'),
      })
      return
    }

    const code = extractInviteCode(input)
    if (!code) {
      await ctx.reply({
        content: t('common.invalid.messages.invite'),
      })
      return
    }

    let invite: Awaited<ReturnType<typeof Invite.fetch>>
    try {
      invite = await Invite.fetch(client, code)
    } catch (error) {
      const isUnknownInvite =
        error instanceof Error &&
        'code' in error &&
        error.code === 'UNKNOWN_INVITE'

      if (!isUnknownInvite) {
        logger.error(`[inviteinfo] Failed to fetch invite "${code}"`, error)
      }

      await ctx.reply({
        content: t('common.notFound.messages.invite', code),
      })
      return
    }

    const lines: string[] = [
      `**${t('commands.inviteinfo.labels.code')}:** \`${invite.code}\``,
      `**${t('commands.inviteinfo.labels.link')}:** ${invite.url}`,
    ]

    const createdText = formatTimestampPair(invite.createdAt)
    if (createdText) {
      lines.push(
        `**${t('commands.inviteinfo.labels.created')}:** ${createdText}`,
      )
    }

    const expiresText = formatTimestampPair(invite.expiresAt)
    lines.push(
      `**${t('commands.inviteinfo.labels.expires')}:** ${expiresText ?? t('commands.inviteinfo.neverExpires')}`,
    )

    if (invite.uses != null) {
      lines.push(`**${t('commands.inviteinfo.labels.uses')}:** ${invite.uses}`)
    }

    if (invite.maxUses != null) {
      lines.push(
        `**${t('commands.inviteinfo.labels.maxUses')}:** ${
          invite.maxUses === 0
            ? t('commands.inviteinfo.labels.unlimited')
            : invite.maxUses
        }`,
      )
    }

    if (invite.inviter) {
      lines.push(
        `**${t('commands.inviteinfo.labels.inviter')}:** ${formatUserTag(invite.inviter)}`,
      )
    }

    const guild = invite.guildSnapshot
    if (guild) {
      lines.push(
        '',
        `**${t('commands.inviteinfo.labels.server')}:** ${guild.name}`,
      )

      if (guild.id) {
        lines.push(
          `**${t('commands.inviteinfo.labels.serverId')}:** \`${guild.id}\``,
        )
      }
      if (invite.memberCount != null) {
        lines.push(
          `**${t('commands.inviteinfo.labels.members')}:** ${invite.memberCount}`,
        )
      }
      if (invite.presenceCount != null) {
        lines.push(
          `**${t('commands.inviteinfo.labels.online')}:** ${invite.presenceCount}`,
        )
      }
    }

    if (invite.channelSnapshot?.name) {
      lines.push(
        `**${t('commands.inviteinfo.labels.channel')}:** ${invite.channelSnapshot.name}`,
      )
    }

    lines.push('', t('commands.inviteinfo.openInBrowser', invite.url))

    const iconUrl = getSnapshotGuildIconUrl(guild?.id, guild?.icon, 256)
    const embed = Embed({
      author: {
        name: t('commands.inviteinfo.title'),
        iconUrl,
      },
      description: lines,
      color: colors.primary,
      thumbnail: iconUrl,
    })

    await ctx.reply({ embeds: [embed] })
  },
})
