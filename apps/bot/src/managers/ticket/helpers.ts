import {
  PermissionFlags,
  type AllowedMentionType,
  type Client,
  type PermissionString,
} from '@fluxerjs/core'
import {
  Ticket,
  TicketConfig,
  type TicketConfigAttrs,
  type TicketRecord,
} from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import type { RestMember } from '@pudim/shared/types'
import { config, emojis, images } from '#bot/config'
import { i18n, type TranslateFunction } from '#bot/i18n'
import {
  fetchMember as fetchUserMember,
  parseUserId as resolveUserId,
  formatUserTag as userTag,
} from '#bot/utils'
import { type EmbedJson } from '#bot/utils/embed'
import { logger } from '#bot/utils/logger'

type Rest = Client['rest']

/** Permissões que o abridor (e a staff) recebem dentro do canal do ticket. */
export const TICKET_MEMBER_PERMISSIONS: PermissionString[] = [
  'ViewChannel',
  'SendMessages',
  'ReadMessageHistory',
  'AttachFiles',
  'EmbedLinks',
]

/** Permissões que o próprio bot precisa dentro do canal do ticket. */
export const TICKET_BOT_PERMISSIONS: PermissionString[] = [
  ...TICKET_MEMBER_PERMISSIONS,
  'AddReactions',
  'ManageMessages',
  'ManageChannels',
  'ManageRoles',
]

/** Permissões necessárias para criar e gerenciar tickets em um servidor. */
export const TICKET_CREATE_PERMISSIONS: PermissionString[] = [
  'ManageChannels',
  'ManageRoles',
  'ViewChannel',
  'SendMessages',
  'ReadMessageHistory',
  'AddReactions',
  'ManageMessages',
  'EmbedLinks',
  'AttachFiles',
]

/** Permissões necessárias para fechar, reabrir e mover tickets. */
export const TICKET_MANAGE_PERMISSIONS: PermissionString[] = [
  'ManageChannels',
  'ManageRoles',
  'ViewChannel',
  'SendMessages',
  'ReadMessageHistory',
  'EmbedLinks',
]

/** Permissões necessárias para enviar e editar o painel. */
export const TICKET_PANEL_PERMISSIONS: PermissionString[] = [
  'ViewChannel',
  'SendMessages',
  'ReadMessageHistory',
  'AddReactions',
  'ManageMessages',
  'EmbedLinks',
]

export const OPEN_KEY_PREFIX = 'ticket:open:'
export const CLOSE_KEY_PREFIX = 'ticket:close:'

/** Embed pronta para enviar (`timestamp` já convertido para a data do envio). */
export type TicketEmbedPayload = Omit<EmbedJson, 'timestamp'> & {
  timestamp?: string
}

export function embedPayload(stored: EmbedJson): TicketEmbedPayload {
  const { timestamp, ...embed } = stored
  return {
    ...embed,
    ...(timestamp ? { timestamp: new Date().toISOString() } : {}),
  }
}

export interface TicketFeedback {
  content: string
  allowedMentions: {
    parse: AllowedMentionType[]
    users: string[]
    roles?: string[]
    repliedUser: false
  }
}

interface FeedbackMentions {
  users?: readonly string[]
  roles?: readonly string[]
}

export function ticketFeedback(
  t: TranslateFunction,
  actorId: string,
  description: string | string[],
  success = false,
  notify: FeedbackMentions = {},
): TicketFeedback {
  const message = Array.isArray(description)
    ? description.join('\n')
    : description
  return {
    content: `${config.separator(success ? emojis.success : emojis.error)} ${t('commands.ticket.feedback', `<@${actorId}>`, message)}`,
    allowedMentions: {
      parse: [],
      users: [...new Set([actorId, ...(notify.users ?? [])])],
      ...(notify.roles?.length ? { roles: [...new Set(notify.roles)] } : {}),
      repliedUser: false,
    },
  }
}

const feedbackReplied = new WeakSet<CommandContext>()

export function ticketFeedbackPages(
  t: TranslateFunction,
  actorId: string,
  description: string | string[],
  success = false,
  notify: FeedbackMentions = {},
): TicketFeedback[] {
  const budget = 2000 - ticketFeedback(t, actorId, '', success).content.length
  const pages: TicketFeedback[] = []
  let remaining = Array.isArray(description)
    ? description.join('\n')
    : description
  while (remaining.length > budget) {
    let end = remaining.lastIndexOf('\n', budget)
    if (end <= 0) end = remaining.lastIndexOf(' ', budget)
    if (end <= 0) {
      end = budget
      const code = remaining.charCodeAt(end - 1)
      if (code >= 0xd800 && code <= 0xdbff) end -= 1
    }
    pages.push(
      ticketFeedback(t, actorId, remaining.slice(0, end), success, notify),
    )
    remaining = remaining.slice(end).trimStart()
  }
  if (remaining || !pages.length)
    pages.push(ticketFeedback(t, actorId, remaining, success, notify))
  for (const page of pages.slice(1)) {
    page.allowedMentions.users = []
    delete page.allowedMentions.roles
  }
  return pages
}

export async function replyTicketFeedback(
  ctx: CommandContext,
  description: string | string[],
  success = false,
  notify: FeedbackMentions = {},
): Promise<void> {
  feedbackReplied.add(ctx)
  for (const message of ticketFeedbackPages(
    ctx.t,
    ctx.author.id,
    description,
    success,
    notify,
  )) {
    await ctx.reply(message)
  }
}

export async function runTicketCommand(
  ctx: CommandContext,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run()
  } catch (error) {
    logger.error('[Ticket] command failed', error)
    if (!feedbackReplied.has(ctx)) {
      try {
        await replyTicketFeedback(ctx, ctx.t('commands.ticket.action.failed'))
      } catch (feedbackError) {
        logger.error('[Ticket] failed to send command feedback', feedbackError)
      }
    }
  } finally {
    feedbackReplied.delete(ctx)
  }
}

export const openKey = (emoji: string) => `${OPEN_KEY_PREFIX}${emoji}`
export const closeKey = (emoji: string) => `${CLOSE_KEY_PREFIX}${emoji}`

const USER_MENTION = /^<@!?(\d+)>$/
const SNOWFLAKE = /^\d{15,25}$/

const TICKET_NAME_VARIABLES = [
  'user.id',
  'username',
  'user.mention',
  'type.name',
  'type.emoji',
  'ticket.count',
  'server.name',
] as const

export type TicketNameVariable = (typeof TICKET_NAME_VARIABLES)[number]

export const TICKET_NAME_VARIABLE_LIST = TICKET_NAME_VARIABLES.map(
  (variable) => `\`{${variable}}\``,
).join(', ')

export const TICKET_NAME_VARIABLE_ALIASES = ['userId', 'type', 'count'] as const

const NAME_VARIABLE = /\{([^{}]*)\}/g

export type TicketNamePatternResult =
  | { ok: true; pattern: string }
  | { ok: false; error: 'empty' | 'tooLong' }
  | { ok: false; error: 'unknown'; variables: string[] }

export function parseUserId(input?: string): string | null {
  if (!input) return null

  const id =
    input.match(USER_MENTION)?.[1] ?? (SNOWFLAKE.test(input) ? input : null)
  if (!id) return null
  return resolveUserId(id) ?? id
}

export async function loadTicketConfig(
  guildId: string,
): Promise<TicketConfigAttrs | null> {
  return TicketConfig.findOne({ guildId }).lean()
}

export async function findTicketByChannel(
  guildId: string,
  channelId: string,
): Promise<TicketRecord | null> {
  return (await Ticket.findOne({
    guildId,
    channelId,
  }).lean()) as TicketRecord | null
}

export async function fetchMember(
  rest: Rest,
  guildId: string,
  userId: string,
): Promise<RestMember | null> {
  return fetchUserMember({ rest }, guildId, userId)
}

type RolePayload = { id: string; permissions?: string }

async function fetchRolesAndMember(
  rest: Rest,
  guildId: string,
  userId: string,
): Promise<{ roles: RolePayload[]; member: RestMember } | null> {
  try {
    const [roles, member] = await Promise.all([
      rest.get(`/guilds/${guildId}/roles`) as Promise<RolePayload[]>,
      rest.get(`/guilds/${guildId}/members/${userId}`) as Promise<RestMember>,
    ])

    return { roles: Array.isArray(roles) ? roles : [], member }
  } catch {
    return null
  }
}

/** Soma as permissões dos cargos do membro (o cargo @everyone sempre conta). */
export async function memberPermissions(
  rest: Rest,
  guildId: string,
  userId: string,
): Promise<bigint | null> {
  const data = await fetchRolesAndMember(rest, guildId, userId)
  if (!data) return null

  let bits = 0n

  for (const role of data.roles) {
    const applies = role.id === guildId || data.member.roles.includes(role.id)
    if (applies && role.permissions) bits |= BigInt(role.permissions)
  }

  return bits
}

export function hasPermissionBits(
  bits: bigint,
  permissions: readonly PermissionString[],
): boolean {
  if ((bits & PermissionFlags.Administrator) !== 0n) return true

  return permissions.every(
    (permission) => (bits & PermissionFlags[permission]) !== 0n,
  )
}

export async function missingPermissions(
  rest: Rest,
  guildId: string,
  userId: string,
  required: readonly PermissionString[],
): Promise<PermissionString[]> {
  const bits = await memberPermissions(rest, guildId, userId)
  if (bits === null) return [...required]

  if ((bits & PermissionFlags.Administrator) !== 0n) return []

  return required.filter(
    (permission) => (bits & PermissionFlags[permission]) === 0n,
  )
}

export function formatPermissionList(
  ctx: CommandContext,
  permissions: readonly PermissionString[],
): string {
  return permissions
    .map((permission) => `**${ctx.t(`common.permissions.${permission}`)}**`)
    .join(', ')
}

export async function replyMissingBotPermissions(
  ctx: CommandContext,
  permissions: readonly PermissionString[],
): Promise<void> {
  await ctx.reply({
    content: `${config.separator(emojis.error)} ${ctx.t(
      'commands.ticket.botPermissions.description',
      formatPermissionList(ctx, permissions),
    )}`,
    allowedMentions: { parse: [] },
  })
}

export async function requireManager(ctx: CommandContext): Promise<boolean> {
  if (await ctx.hasPermission('ManageGuild')) return true

  await ctx.reply({
    content: `${config.separator(emojis.error)} ${ctx.t('commands.ticket.staffOnly.description')}`,
    allowedMentions: { parse: [] },
  })
  return false
}

export async function isStaffMember(
  rest: Rest,
  guildId: string,
  userId: string,
  config: TicketConfigAttrs | null,
): Promise<boolean> {
  const data = await fetchRolesAndMember(rest, guildId, userId)
  if (!data) return false

  const staffRoleIds = config?.staffRoleIds ?? []
  if (data.member.roles.some((roleId) => staffRoleIds.includes(roleId))) {
    return true
  }

  const guild = (await rest.get(`/guilds/${guildId}`).catch(() => null)) as {
    owner_id?: string
  } | null
  if (guild?.owner_id === userId) return true

  let bits = 0n
  for (const role of data.roles) {
    const applies = role.id === guildId || data.member.roles.includes(role.id)
    if (applies && role.permissions) bits |= BigInt(role.permissions)
  }

  return hasPermissionBits(bits, ['ManageChannels'])
}

export interface TemporaryMessageOptions {
  content: string
  allowedMentions?: {
    parse?: string[]
    users?: string[]
    roles?: string[]
    repliedUser?: boolean
  }
}

/** Envia uma mensagem curta que é apagada sozinha (sem DM, sem ping em massa). */
export async function sendTemporaryMessage(
  rest: Rest,
  channelId: string,
  options: TemporaryMessageOptions,
  ms: number,
): Promise<string | null> {
  const body: Record<string, unknown> = {}
  if (options.content !== undefined) body.content = options.content
  if (options.allowedMentions) {
    body.allowed_mentions = {
      parse: options.allowedMentions.parse ?? [],
      users: options.allowedMentions.users,
      roles: options.allowedMentions.roles,
      replied_user: options.allowedMentions.repliedUser,
    }
  }

  const message = (await rest
    .post(`/channels/${channelId}/messages`, { body })
    .catch((error) => {
      logger.error('[Ticket] failed to send temporary feedback', error)
      return null
    })) as { id?: string } | null

  if (message?.id) {
    const timer = setTimeout(() => {
      void rest
        .delete(`/channels/${channelId}/messages/${message.id}`)
        .catch((error) =>
          logger.error('[Ticket] failed to delete temporary feedback', error),
        )
    }, ms)
    timer.unref?.()
  }

  return message?.id ?? null
}

export function validateTicketNamePattern(
  input: string,
): TicketNamePatternResult {
  const pattern = input.trim()
  if (!pattern) return { ok: false, error: 'empty' }

  if (pattern.length > 100) return { ok: false, error: 'tooLong' }

  const variables: string[] = []
  for (const match of pattern.matchAll(NAME_VARIABLE)) {
    const variable = match[1]
    if (variable !== undefined) variables.push(variable)
  }

  const accepted = new Set<string>([
    ...TICKET_NAME_VARIABLES,
    ...TICKET_NAME_VARIABLE_ALIASES,
  ])
  const unknown = [
    ...new Set(variables.filter((variable) => !accepted.has(variable))),
  ]
  const leftover = pattern.replace(NAME_VARIABLE, '')
  if (leftover.includes('{') || leftover.includes('}')) {
    unknown.push('{')
  }
  if (unknown.length) return { ok: false, error: 'unknown', variables: unknown }

  return { ok: true, pattern }
}

const nameSegments = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function renderTicketName(
  pattern: string,
  values: {
    username: string
    userId: string
    typeName: string
    typeEmoji: string
    count: number
    serverName: string
  },
): string {
  const count = String(values.count).padStart(3, '0')

  const replacements: Record<
    TicketNameVariable | (typeof TICKET_NAME_VARIABLE_ALIASES)[number],
    string
  > = {
    'user.id': values.userId,
    username: values.username,
    'user.mention': `<@${values.userId}>`,
    'type.name': values.typeName,
    'type.emoji': values.typeEmoji,
    'ticket.count': count,
    'server.name': values.serverName,
    userId: values.userId,
    type: values.typeName,
    count,
  }
  const name = pattern
    .replace(NAME_VARIABLE, (match, variable: string) =>
      Object.hasOwn(replacements, variable)
        ? replacements[variable as keyof typeof replacements]
        : match,
    )
    .trim()
    .replace(/\s+/g, ' ')

  // Fluxer limits names to 100 UTF-16 units; API normalization depends on guild features.
  let limited = ''
  for (const { segment } of nameSegments.segment(name)) {
    if (limited.length + segment.length > 100) break
    limited += segment
  }
  if (!limited) throw new Error('empty ticket channel name')
  return limited
}

export function serverIconUrl(
  guild: { iconURL?: (options?: { size?: number }) => string | null } | null,
): string {
  return guild?.iconURL?.({ size: 256 }) ?? images.defaultAvatar
}

export function formatTicketUserTag(
  source: {
    id?: string
    username?: string | null
    discriminator?: string | null
    user?: RestMember['user']
  },
  t: TranslateFunction,
): string {
  return userTag({
    id: source.user?.id ?? source.id ?? '',
    username:
      source.user?.username ??
      source.username ??
      t('commands.ticket.unknownUser'),
    discriminator: source.user?.discriminator ?? source.discriminator,
  })
}

export async function getUserTag(
  client: Pick<Client, 'users'>,
  userId: string,
): Promise<string> {
  const user = await client.users.fetch(userId).catch(() => null)
  if (user) return userTag(user)
  return formatTicketUserTag({ id: userId }, i18n.getTranslator())
}
