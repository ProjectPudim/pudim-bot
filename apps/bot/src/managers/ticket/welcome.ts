import { colors } from '#bot/config'
import type { TranslateFunction } from '#bot/i18n'
import { escapeMarkdown } from '#bot/utils'
import { EMBED_LIMITS, type EmbedJson } from '#bot/utils/embed'

export interface TicketWelcomeContext {
  username: string
  userId: string
  ticketType: string
  ticketNumber: number
  channelId: string
  serverName: string
  closeEmoji: string
}

interface WelcomeVariable {
  name: string
  description: (t: TranslateFunction) => string
  resolve: (context: TicketWelcomeContext) => string
}

const ticketNumber = (value: number) => String(value).padStart(3, '0')

export const TICKET_WELCOME_VARIABLES: readonly WelcomeVariable[] = [
  {
    name: '{username}',
    description: (t) => t('commands.ticket.usage.welcome.variables.username'),
    resolve: (context) => escapeMarkdown(context.username),
  },
  {
    name: '{user.id}',
    description: (t) => t('commands.ticket.usage.welcome.variables.userId'),
    resolve: (context) => context.userId,
  },
  {
    name: '{user.mention}',
    description: (t) =>
      t('commands.ticket.usage.welcome.variables.userMention'),
    resolve: (context) => `<@${context.userId}>`,
  },
  {
    name: '{ticket.type}',
    description: (t) => t('commands.ticket.usage.welcome.variables.ticketType'),
    resolve: (context) => context.ticketType,
  },
  {
    name: '{ticket.number}',
    description: (t) =>
      t('commands.ticket.usage.welcome.variables.ticketNumber'),
    resolve: (context) => ticketNumber(context.ticketNumber),
  },
  {
    name: '{ticket.channel}',
    description: (t) =>
      t('commands.ticket.usage.welcome.variables.ticketChannel'),
    resolve: (context) => `<#${context.channelId}>`,
  },
  {
    name: '{server.name}',
    description: (t) => t('commands.ticket.usage.welcome.variables.serverName'),
    resolve: (context) => context.serverName,
  },
  {
    name: '{close.emoji}',
    description: (t) => t('commands.ticket.usage.welcome.variables.closeEmoji'),
    resolve: (context) => context.closeEmoji,
  },
]

const KNOWN_VARIABLES = new Set(
  TICKET_WELCOME_VARIABLES.map((variable) => variable.name),
)

const VARIABLE = /\{[^{}]+\}/g

const size = (value: string) => [...value].length

function truncate(value: string, max: number): string {
  if (size(value) <= max) return value
  return [...value].slice(0, max).join('')
}

function applyVariables(value: string, context: TicketWelcomeContext): string {
  let result = value
  for (const variable of TICKET_WELCOME_VARIABLES) {
    result = result.replaceAll(variable.name, variable.resolve(context))
  }
  return result
}

function enforceTotalLimit(embed: EmbedJson): EmbedJson {
  const total =
    size(embed.title ?? '') +
    size(embed.description ?? '') +
    size(embed.footer?.text ?? '') +
    size(embed.author?.name ?? '')

  if (total <= EMBED_LIMITS.total || !embed.description) return embed

  const excess = total - EMBED_LIMITS.total
  embed.description = truncate(
    embed.description,
    Math.max(0, size(embed.description) - excess),
  )
  return embed
}

/** Aplica as variáveis em uma cópia da embed, sem alterar o JSON guardado. */
export function renderWelcomeEmbed(
  stored: EmbedJson,
  context: TicketWelcomeContext,
): EmbedJson {
  const embed: EmbedJson = {
    ...stored,
    ...(stored.author ? { author: { ...stored.author } } : {}),
    ...(stored.footer ? { footer: { ...stored.footer } } : {}),
  }

  if (embed.title !== undefined) {
    embed.title = truncate(
      applyVariables(embed.title, context),
      EMBED_LIMITS.title,
    )
  }

  if (embed.description !== null) {
    embed.description = truncate(
      applyVariables(embed.description, context),
      EMBED_LIMITS.description,
    )
  }

  if (embed.author) {
    embed.author.name = truncate(
      applyVariables(embed.author.name, context),
      EMBED_LIMITS.authorName,
    )
  }

  if (embed.footer) {
    embed.footer.text = truncate(
      applyVariables(embed.footer.text, context),
      EMBED_LIMITS.footerText,
    )
  }

  return enforceTotalLimit(embed)
}

export function defaultWelcomeEmbed(t: TranslateFunction): EmbedJson {
  return {
    title: t('commands.ticket.welcome.default.title'),
    description: t('commands.ticket.welcome.default.description'),
    color: Number.parseInt(colors.primary.slice(1), 16),
  }
}

export function findUnknownWelcomeVariables(embed: EmbedJson): string[] {
  const texts = [
    embed.title,
    embed.description,
    embed.footer?.text,
    embed.author?.name,
  ]
  const unknown = new Set<string>()

  for (const text of texts) {
    if (!text) continue

    for (const match of text.matchAll(VARIABLE)) {
      if (!KNOWN_VARIABLES.has(match[0])) unknown.add(match[0])
    }
  }

  return [...unknown]
}

/** Lista usada no tutorial, sempre igual às variáveis aceitas na substituição. */
export function welcomeVariableHelp(t: TranslateFunction): string {
  return TICKET_WELCOME_VARIABLES.map(
    (variable) => `\`${variable.name}\` ${variable.description(t)}`,
  ).join('\n')
}
