import { SnowflakeUtil } from '@fluxerjs/util'
import { createCommand } from '#bot/fluxer'
import { fetchFluxerProfile } from '#bot/utils/apis/felipw'
import { colors, emojis } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'
import { fetchMember, parseTargetId } from '#bot/utils/user'

const USAGE = '{prefix}userinfo [@user|id]'

const FALLBACK_AVATAR = 'https://fluxerstatic.com/web/apple-touch-icon.png'

const MAX_DESCRIPTION = 4096
const MAX_FIELD_VALUE = 1024
const MAX_FIELD_NAME = 256
const MAX_CONNECTIONS = 15

// Timeouts keep a slow source from delaying the response.
const API_TIMEOUT = 4_000
const CLIENT_TIMEOUT = 3_000
const MEMBER_TIMEOUT = 3_000

type BadgeTypes = keyof typeof emojis.badges

function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/([*_~`|>[\]()])/g, '\\$1')
    .replace(/@/g, '@\u200b')
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function safeText(value: string, max: number): string {
  return truncate(escapeMarkdown(value), max)
}

// Resolves to null on failure or timeout.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
    )
  })
}

// Markdown links and custom emojis can't be escaped without breaking.
const BIO_TOKEN_REGEX =
  /\[([^\]\n]{1,100})\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\)){1,500})\)|<a?:\w{2,32}:\d{17,20}>/g

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value)

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null
    }

    if (url.username || url.password) return null

    // Parentheses break markdown links.
    return url.toString().replace(/\(/g, '%28').replace(/\)/g, '%29')
  } catch {
    return null
  }
}

// Trim escaped text to fit max without splitting an escape.
function escapeToFit(raw: string, max: number): string {
  if (max <= 0) return ''

  if (escapeMarkdown(raw).length <= max) return escapeMarkdown(raw)

  let cut = Math.min(raw.length, max)

  while (cut > 0 && escapeMarkdown(raw.slice(0, cut)).length > max) {
    cut--
  }

  return escapeMarkdown(raw.slice(0, cut))
}

// Keep markdown links intact; never cut inside one.
function formatBio(value: string, max: number): string {
  const input = value.slice(0, 4000)

  const tokens: Array<{ text: string } | { link: string }> = []
  let lastIndex = 0

  for (const match of input.matchAll(BIO_TOKEN_REGEX)) {
    const index = match.index ?? 0

    tokens.push({ text: input.slice(lastIndex, index) })

    if (match[1] === undefined) {
      tokens.push({ link: match[0] })
    } else {
      const url = safeUrl(match[2] ?? '')

      if (url) {
        tokens.push({ link: `[${escapeMarkdown(match[1])}](${url})` })
      } else {
        tokens.push({ text: match[0] })
      }
    }

    lastIndex = index + match[0].length
  }

  tokens.push({ text: input.slice(lastIndex) })

  const rendered = tokens.map((token) =>
    'link' in token ? token.link : escapeMarkdown(token.text),
  )

  const full = rendered.join('')

  if (full.length <= max) return full

  // Reserve one char for the ellipsis when truncating.
  const budget = max - 1
  let output = ''

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!

    if ('link' in token) {
      if (output.length + token.link.length > budget) break

      output += token.link
      continue
    }

    const piece = escapeToFit(token.text ?? '', budget - output.length)

    output += piece

    if (piece.length < (rendered[i]?.length ?? 0)) break
  }

  return `${output}…`
}

function timestamp(value: string | Date | null | undefined): number | null {
  if (!value) return null

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? Math.floor(time / 1000) : null
}

function formatTimestamp(value: number | null): string | null {
  if (value === null) return null
  return `<t:${value}:f> (<t:${value}:R>)`
}

function connectionUrl(type: string, name: string): string | null {
  const value = name.trim()
  if (!value) return null

  try {
    let url: URL

    switch (type) {
      case 'domain': {
        if (
          value.includes('/') ||
          value.includes('@') ||
          value.includes('\\') ||
          value.includes('?') ||
          value.includes('#') ||
          value.includes(':') ||
          /\s/.test(value)
        ) {
          return null
        }

        url = new URL(`https://${value}`)

        if (
          !url.hostname.includes('.') ||
          url.hostname.startsWith('.') ||
          url.hostname.endsWith('.')
        ) {
          return null
        }

        break
      }

      case 'bsky': {
        if (!/^[a-zA-Z0-9._-]+$/.test(value) || value.length > 253) {
          return null
        }

        url = new URL(`https://bsky.app/profile/${encodeURIComponent(value)}`)
        break
      }

      default:
        return null
    }

    if (url.protocol !== 'https:') return null
    if (url.username || url.password) return null

    return url.toString()
  } catch {
    return null
  }
}

export default createCommand({
  name: 'userinfo',
  description: 'Shows information about a user.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre um usuário.',
    'es-ES': 'Muestra información sobre un usuario.',
  },
  category: 'utility',
  usage: USAGE,
  aliases: ['ui', 'uinfo', 'whois'],

  async run(ctx) {
    const { t, args, author, client, guildId } = ctx

    const raw = args[0]?.trim()
    const targetId = raw ? parseTargetId(raw) : author.id

    if (!targetId) {
      await ctx.reply({
        content: t('common.invalid.messages.user'),
      })
      return
    }

    // Member lookup is independent, so start it in parallel with the profile fetch.
    const memberPromise = guildId
      ? withTimeout(fetchMember(client, guildId, targetId), MEMBER_TIMEOUT)
      : Promise.resolve(null)

    // Primary source: API, with timeout so fallback is fast.
    const apiUser = await withTimeout(fetchFluxerProfile(targetId), API_TIMEOUT)

    // Fallback: client, only if the API failed.
    const user = apiUser
      ? null
      : targetId === author.id
        ? author
        : await withTimeout(client.users.fetch(targetId), CLIENT_TIMEOUT)

    const member = await memberPromise

    if (!apiUser && !user) {
      await ctx.reply({
        content: t('common.notFound.messages.user', raw ?? targetId),
      })
      return
    }

    const avatarUrl =
      apiUser?.avatarUrl ??
      (user?.avatar
        ? user.avatarURL({
            size: 512,
            extension: user.avatar.startsWith('a_') ? 'gif' : 'png',
          })
        : null) ??
      null

    const bannerUrl =
      apiUser?.profile?.bannerUrl ??
      (user?.banner
        ? user.bannerURL({
            size: 512,
            extension: user.banner.startsWith('a_') ? 'gif' : 'png',
          })
        : null) ??
      null

    const username = apiUser?.username ?? user?.username ?? targetId

    const discriminator = apiUser?.discriminator ?? user?.discriminator ?? '0'

    const displayName =
      apiUser?.global_name?.trim() || user?.globalName?.trim() || username

    const isBot = apiUser?.bot ?? user?.bot ?? false

    const accountType = isBot
      ? t('commands.userinfo.accountType.bot')
      : t('commands.userinfo.accountType.user')

    // Created timestamp comes from the snowflake ID, independent of both sources.
    const createdAt = timestamp(SnowflakeUtil.dateFromSnowflake(targetId))

    // Badges come only from the API.
    const badges = apiUser?.badges ?? []

    const badgeEmojis = badges
      .map((badge) => emojis.badges[badge.key as BadgeTypes])
      .filter(Boolean)
      .join(' ')

    const userLines: string[] = [
      `### [${safeText(username, 128)}](https://fluxer.com/users/${targetId}) ${badgeEmojis}`.trim(),
      `**${t('commands.userinfo.labels.username')}:** \`${safeText(`${username}#${discriminator}`, 128)}\``,
      `**${t('commands.userinfo.labels.displayName')}:** ${safeText(displayName, 256)}`,
      `**${t('commands.userinfo.labels.id')}:** \`${targetId}\``,
      `**${t('commands.userinfo.labels.accountType')}:** ${accountType}`,
    ]

    const createdText = formatTimestamp(createdAt)

    if (createdText) {
      userLines.push(
        `**${t('commands.userinfo.labels.created')}:** ${createdText}`,
      )
    }

    const fields: {
      name: string
      value: string
      inline: boolean
    }[] = []

    const bio = apiUser?.profile?.bio?.trim()

    if (bio) {
      fields.push({
        name: truncate(t('commands.userinfo.labels.bio'), MAX_FIELD_NAME),
        value: formatBio(bio, MAX_FIELD_VALUE),
        inline: false,
      })
    }

    const publicConnections = (apiUser?.connected_accounts ?? [])
      .filter((account) => ((account.visibility_flags ?? 0) & 1) !== 0)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .slice(0, MAX_CONNECTIONS)

    const connectionLinks = publicConnections
      .map((account) => {
        const url = connectionUrl(account.type, account.name)

        if (!url) return null

        const name = safeText(account.name, 100)

        return `[${name}](${url})`
      })
      .filter((value): value is string => value !== null)

    if (connectionLinks.length) {
      fields.push({
        name: truncate(
          t('commands.userinfo.labels.connections'),
          MAX_FIELD_NAME,
        ),
        value: truncate(connectionLinks.join(' · '), MAX_FIELD_VALUE),
        inline: false,
      })
    }

    const links: string[] = []

    if (avatarUrl) {
      links.push(t('commands.userinfo.links.avatar', avatarUrl))
    }

    if (bannerUrl) {
      links.push(t('commands.userinfo.links.banner', bannerUrl))
    }

    if (links.length) {
      userLines.push('', `-# ${links.join(' · ')}`)
    }

    const userEmbed = Embed({
      author: {
        name: t('commands.userinfo.userTitle'),
      },
      description: truncate(
        userLines.filter(Boolean).join('\n'),
        MAX_DESCRIPTION,
      ),
      color: colors.primary,
      fields,
      thumbnail: avatarUrl ?? FALLBACK_AVATAR,
    })

    const embeds = [userEmbed]

    if (member) {
      const joinedAt = timestamp(member.joined_at)
      const memberRoles = member.roles ?? []

      const roleMentions = memberRoles.length
        ? memberRoles.map((roleId) => `<@&${roleId}>`).join(', ')
        : t('commands.userinfo.labels.noRoles')

      const memberLines: string[] = []

      const joinedText = formatTimestamp(joinedAt)

      if (joinedText) {
        memberLines.push(
          `**${t('commands.userinfo.labels.joined')}:** ${joinedText}`,
        )
      }

      memberLines.push(
        `**${t('commands.userinfo.labels.roles')}:** ${truncate(roleMentions, 3000)}`,
      )

      const facts: string[] = []

      if (member.nick) {
        facts.push(
          t('commands.userinfo.facts.nickname', safeText(member.nick, 128)),
        )
      }

      if (member.communication_disabled_until) {
        const timeoutTs = timestamp(member.communication_disabled_until)

        if (timeoutTs !== null && timeoutTs > Math.floor(Date.now() / 1000)) {
          facts.push(t('commands.userinfo.facts.timeout', timeoutTs))
        }
      }

      if (facts.length) {
        memberLines.push('')
        memberLines.push(`**${t('commands.userinfo.facts.title')}:**`)
        memberLines.push(...facts)
      }

      const memberEmbed = Embed({
        author: {
          name: t('commands.userinfo.memberTitle'),
        },
        description: truncate(memberLines.join('\n'), MAX_DESCRIPTION),
        color: colors.primary,
      })

      embeds.push(memberEmbed)
    }

    await ctx.reply({
      embeds,
      allowedMentions: {
        parse: [],
        users: [author.id],
        roles: [],
        repliedUser: true,
      },
    })
  },
})
