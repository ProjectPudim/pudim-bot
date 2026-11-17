import { Invite } from '@fluxerjs/core'
import { createCommand } from '#bot/fluxer'
import { colors } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'

const USAGE = '{prefix}inviteinfo <invite|code>'

const RECOGNIZED_HOSTS = new Set([
  'fluxer.gg',
  'www.fluxer.gg',
  'fluxer.com',
  'www.fluxer.com',
  'web.fluxer.app',
])

const INVITE_CODE_PATTERN = /^[a-zA-Z0-9-]{2,}$/

function extractInviteCode(input: string): string | null {
  const trimmed = input.trim()

  if (!trimmed) return null

  if (INVITE_CODE_PATTERN.test(trimmed)) {
    return trimmed
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    )

    if (!RECOGNIZED_HOSTS.has(url.hostname.toLowerCase())) {
      return null
    }

    const segments = url.pathname.split('/').filter(Boolean)

    if (segments.length === 1) {
      const code = segments[0]

      return code && INVITE_CODE_PATTERN.test(code) ? code : null
    }

    if (segments.length === 2) {
      const [prefix, code] = segments

      if (
        prefix?.toLowerCase() === 'invite' &&
        code &&
        INVITE_CODE_PATTERN.test(code)
      ) {
        return code
      }
    }

    return null
  } catch {
    return null
  }
}

function toTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

export default createCommand({
  name: 'inviteinfo',
  description: 'Shows information about an invite.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre um convite.',
    'es-ES': 'Muestra información sobre una invitación.',
  },
  category: 'utility',
  usage: USAGE,
  aliases: ['invite'],

  async run(ctx) {
    const { t, args, client } = ctx

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
        console.error(`[inviteinfo] Failed to fetch invite "${code}":`, error)
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

    if (invite.createdAt) {
      const timestamp = toTimestamp(invite.createdAt)

      lines.push(
        `**${t('commands.inviteinfo.labels.created')}:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
      )
    }

    if (invite.expiresAt) {
      const timestamp = toTimestamp(invite.expiresAt)

      lines.push(
        `**${t('commands.inviteinfo.labels.expires')}:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
      )
    } else {
      lines.push(
        `**${t('commands.inviteinfo.labels.expires')}:** ${t('commands.inviteinfo.neverExpires')}`,
      )
    }

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
      const inviter = invite.inviter

      lines.push(
        `**${t('commands.inviteinfo.labels.inviter')}:** \`${inviter.username}#${inviter.discriminator} (${inviter.id})\``,
      )
    }

    const guild = invite.guildSnapshot

    if (guild) {
      lines.push('')

      lines.push(`**${t('commands.inviteinfo.labels.server')}:** ${guild.name}`)

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

    const channel = invite.channelSnapshot

    if (channel?.name) {
      lines.push(
        `**${t('commands.inviteinfo.labels.channel')}:** ${channel.name}`,
      )
    }

    const icon = guild?.icon

    const iconUrl =
      guild?.id && icon
        ? `https://fluxerusercontent.com/icons/${guild.id}/${icon}.${icon.startsWith('a_') ? 'gif' : 'png'}?size=256`
        : undefined

    const embed = Embed({
      author: {
        name: t('commands.inviteinfo.title'),
        iconUrl,
      },
      description: [
        ...lines,
        '',
        t('commands.inviteinfo.openInBrowser', invite.url),
      ].join('\n'),
      color: colors.primary,
      thumbnail: iconUrl,
    })

    await ctx.reply({
      embeds: [embed],
    })
  },
})
