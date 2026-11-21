import {
  ChannelType,
  OverwriteType,
  type Client,
  type EmbedBuilder,
  type GuildChannel,
  type PermissionString,
} from '@fluxerjs/core'
import {
  DEFAULT_TICKET_NAME_PATTERN,
  Ticket,
  TicketConfig as TicketConfigModel,
  type TicketCloseAction,
  type TicketOption,
  type TicketRecord,
} from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import { config as botConfig, colors, emojis, images } from '#bot/config'
import { i18n, type TranslateFunction } from '#bot/i18n'
import { reactionManager, type ReactionContext } from '#bot/managers/reaction'
import { parseChannelId } from '#bot/utils'
import { Embed, type EmbedJson } from '#bot/utils/embed'
import { parseEmoji } from '#bot/utils/emojis'
import { logger } from '#bot/utils/logger'
import {
  CLOSE_KEY_PREFIX,
  closeKey,
  embedPayload,
  fetchMember,
  findTicketByChannel,
  formatTicketUserTag,
  getUserTag,
  isStaffMember,
  loadTicketConfig,
  missingPermissions,
  OPEN_KEY_PREFIX,
  parseUserId,
  renderTicketName,
  replyMissingBotPermissions,
  sendTemporaryMessage,
  serverIconUrl,
  TICKET_BOT_PERMISSIONS,
  TICKET_CREATE_PERMISSIONS,
  TICKET_MANAGE_PERMISSIONS,
  TICKET_MEMBER_PERMISSIONS,
  ticketFeedback,
  ticketFeedbackPages,
} from './helpers'
import { replyTicketUsageError, replyUsage } from './usage'
import { defaultWelcomeEmbed, renderWelcomeEmbed } from './welcome'

type Rest = Client['rest']
type TicketConfig = NonNullable<Awaited<ReturnType<typeof loadTicketConfig>>>

const TEMP_MESSAGE_MS = 5000
const STAFF_NOTICE_MS = 12000
const DELAY_MESSAGE_MS = 5000

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

const OPEN_REGISTRY_KEY = `${OPEN_KEY_PREFIX}*`
const CLOSE_REGISTRY_KEY = `${CLOSE_KEY_PREFIX}*`

reactionManager.registry({
  key: OPEN_REGISTRY_KEY,
  emoji: (key) => key.slice(OPEN_KEY_PREFIX.length),
  filter: reactionManager.filters.anyone,
  concurrent: true,
  process: 'single',
  cooldownMs: 3000,
  run: (ctx) => ticketActionManager.open(ctx),
})

reactionManager.registry({
  key: CLOSE_REGISTRY_KEY,
  emoji: (key) => key.slice(CLOSE_KEY_PREFIX.length),
  filter: reactionManager.filters.anyone,
  process: 'single',
  cooldownMs: 2000,
  run: (ctx) => ticketActionManager.closeFromReaction(ctx),
})

type CloseDmInput = {
  client: Client
  guildId: string
  ticket: TicketRecord
  actorId: string
  reason: string | null
  closedAt: Date
}

type CloseInput = {
  client: Client
  rest: Rest
  guildId: string
  channelId: string
  actorId: string
  reason: string | null
  t: TranslateFunction
  context: CommandContext | null
}

export class TicketActionManager {
  private readonly closing = new Set<string>()
  private readonly opening = new Set<string>()

  private closeSettings(config: TicketConfig | null) {
    return {
      action: (config?.close?.action === 'delete'
        ? 'delete'
        : 'archive') as TicketCloseAction,
      delay: config?.close?.delay ?? 5,
      emoji: config?.close?.emoji ?? '❌',
      openerCanClose: config?.close?.openerCanClose !== false,
      dm: config?.close?.dm !== false,
    }
  }

  private async fetchGuildChannel(
    client: Client,
    guildId: string,
    channelId: string,
  ): Promise<GuildChannel | null> {
    const channel = await client.channels.fetch(channelId).catch((error) => {
      logger.error('[Ticket] failed to fetch a guild channel', error)
      return null
    })
    if (!channel || !channel.isGuild() || channel.guildId !== guildId) {
      return null
    }
    return channel
  }

  private async openFeedback(
    client: Client,
    channelId: string,
    actorId: string,
    t: TranslateFunction,
    description: string,
    success = false,
  ): Promise<void> {
    await sendTemporaryMessage(
      client.rest,
      channelId,
      ticketFeedback(t, actorId, description, success),
      TEMP_MESSAGE_MS,
    )
  }

  private async findOpenTicket(
    client: Client,
    guildId: string,
    openerId: string,
  ): Promise<TicketRecord | null> {
    const tickets = (await Ticket.find({ guildId, openerId, status: 'open' })
      .sort({ createdAt: 1, _id: 1 })
      .lean()) as TicketRecord[]

    for (const ticket of tickets) {
      let channel: Awaited<ReturnType<Client['channels']['fetch']>>
      try {
        channel = await client.channels.fetch(ticket.channelId, { force: true })
      } catch (error) {
        const cause =
          error instanceof Error && error.cause ? error.cause : error
        if (
          typeof cause !== 'object' ||
          cause === null ||
          !('statusCode' in cause) ||
          cause.statusCode !== 404
        ) {
          throw error
        }

        await Ticket.deleteOne({
          _id: ticket._id,
          guildId,
          openerId,
          channelId: ticket.channelId,
          status: 'open',
        })
        if (ticket.welcomeMessageId) {
          await reactionManager
            .unbind(client, ticket.welcomeMessageId, { clearReactions: false })
            .catch((unbindError) =>
              logger.error(
                '[Ticket] failed to unbind an orphan ticket',
                unbindError,
              ),
            )
        }
        continue
      }

      if (
        !channel?.isGuild() ||
        channel.guildId !== guildId ||
        !channel.isText()
      ) {
        throw new Error(`invalid channel for ticket ${ticket._id}`)
      }
      return ticket
    }
    return null
  }

  private async log(
    client: Client,
    config: TicketConfig | null,
    embed: EmbedBuilder,
  ): Promise<void> {
    const channelId = config?.logChannelId
    if (!channelId) return

    await client.channels
      .send(channelId, {
        embeds: [embed],
        allowedMentions: { parse: [] },
      })
      .catch((error) => logger.error('[Ticket] failed to send log', error))
  }

  private async ensureBotPermissions(
    client: Client,
    guildId: string,
    required: readonly PermissionString[],
    input: {
      t: TranslateFunction
      context: CommandContext | null
      noticeChannelId: string
      config: TicketConfig | null
      feedback?: (description: string) => Promise<void>
      actorId: string
    },
  ): Promise<boolean> {
    const botId = client.user?.id
    if (!botId) {
      if (input.feedback) {
        await input.feedback(
          input.t('commands.ticket.open.failedNotice.description'),
        )
      }
      return false
    }

    const missing = await missingPermissions(
      client.rest,
      guildId,
      botId,
      required,
    )
    if (!missing.length) return true

    const names = missing
      .map((permission) => `**${input.t(`common.permissions.${permission}`)}**`)
      .join(', ')

    if (input.feedback) {
      await input.feedback(
        input.t('commands.ticket.action.botPermissions', names),
      )
    } else if (input.context) {
      await replyMissingBotPermissions(input.context, missing)
    } else {
      await sendTemporaryMessage(
        client.rest,
        input.noticeChannelId,
        ticketFeedback(
          input.t,
          input.actorId,
          input.t('commands.ticket.action.botPermissions', names),
        ),
        STAFF_NOTICE_MS,
      )
    }

    return false
  }

  async open(ctx: ReactionContext): Promise<void> {
    const { guildId, clickerId, client, channelId: panelChannelId } = ctx
    if (!guildId) return

    const openingKey = `${guildId}:${clickerId}`
    if (this.opening.has(openingKey)) return
    this.opening.add(openingKey)
    const t = i18n.getTranslator()
    const feedback = (description: string, success = false) =>
      this.openFeedback(
        client,
        panelChannelId,
        clickerId,
        t,
        description,
        success,
      )
    try {
      const config = await loadTicketConfig(guildId)

      if (config?.blacklist?.includes(clickerId)) {
        await feedback(t('commands.ticket.open.blacklisted.description'))
        return
      }

      const existing = await this.findOpenTicket(client, guildId, clickerId)

      if (existing) {
        await feedback(
          t('commands.ticket.open.alreadyOpen.description', existing.channelId),
        )
        return
      }

      const display = ctx.key.slice(OPEN_KEY_PREFIX.length)
      const parsed = parseEmoji(display)
      const optionId = parsed?.id ?? display
      const options: TicketOption[] = (config?.options ?? []) as TicketOption[]
      const option = options.find((item) => item.id === optionId)

      if (!option) {
        await feedback(t('commands.ticket.open.optionGone.description'))
        return
      }

      if (
        !(await this.ensureBotPermissions(
          client,
          guildId,
          TICKET_CREATE_PERMISSIONS,
          {
            t,
            context: null,
            noticeChannelId: panelChannelId,
            config,
            feedback,
            actorId: clickerId,
          },
        ))
      ) {
        return
      }

      const panelChannel = await this.fetchGuildChannel(
        client,
        guildId,
        panelChannelId,
      )
      const parentFallback = panelChannel?.parentId ?? null

      let categoryId = parentFallback
      if (config?.openCategoryId) {
        const category = await this.fetchGuildChannel(
          client,
          guildId,
          config.openCategoryId,
        )
        if (!category?.isCategory()) {
          await feedback(t('commands.ticket.open.brokenCategory.description'))
          await this.log(
            client,
            config,
            Embed({
              title: t('commands.ticket.log.openFailed.title'),
              description: t('commands.ticket.open.brokenCategory.description'),
              color: colors.danger,
            }),
          )
          return
        }
        categoryId = category.id
      }

      const member = await fetchMember(client.rest, guildId, clickerId)
      if (!member?.user) {
        await feedback(t('commands.ticket.open.memberNotFound.description'))
        return
      }

      const counter = await TicketConfigModel.findOneAndUpdate(
        { guildId },
        { $inc: { counter: 1 } },
        { returnDocument: 'after', upsert: true },
      )
        .select('counter')
        .lean()
      const number = counter?.counter
      if (!number || !Number.isSafeInteger(number) || number < 1) {
        throw new Error('invalid ticket counter')
      }
      const guild = await client.guilds.fetch(guildId)
      if (!guild) throw new Error('ticket guild is unavailable')

      const botId = client.user?.id
      const staffRoleIds = config?.staffRoleIds ?? []

      let created: GuildChannel | null = null
      let welcomeMessageId: string | null = null
      let ticketId: string | null = null

      try {
        const name = renderTicketName(
          config?.namePattern ?? DEFAULT_TICKET_NAME_PATTERN,
          {
            username: member.user.username,
            userId: clickerId,
            typeName: option.name,
            typeEmoji: option.emoji,
            count: number,
            serverName: guild.name,
          },
        )
        created = await guild.createChannel({
          name,
          type: ChannelType.GuildText,
          parentId: categoryId,
          permissionOverwrites: [
            {
              id: guildId,
              type: OverwriteType.Role,
              deny: ['ViewChannel'],
            },
            {
              id: clickerId,
              type: OverwriteType.Member,
              allow: TICKET_MEMBER_PERMISSIONS,
            },
            ...staffRoleIds.map((roleId) => ({
              id: roleId,
              type: OverwriteType.Role,
              allow: TICKET_MEMBER_PERMISSIONS,
            })),
            ...(botId
              ? [
                  {
                    id: botId,
                    type: OverwriteType.Member,
                    allow: TICKET_BOT_PERMISSIONS,
                  },
                ]
              : []),
          ],
        })

        const textChannel = created.isText() ? created : null
        if (!textChannel) throw new Error('created channel is not text based')

        const settings = this.closeSettings(config)
        const welcomeSource =
          (config?.welcome?.embed as EmbedJson | null | undefined) ??
          defaultWelcomeEmbed(t)
        const welcome = embedPayload(
          renderWelcomeEmbed(welcomeSource, {
            username: member.user.username,
            userId: clickerId,
            ticketType: option.name,
            ticketNumber: number,
            channelId: textChannel.id,
            serverName: guild.name,
            closeEmoji: settings.emoji,
          }),
        )
        const mentions = [
          `<@${clickerId}>`,
          ...staffRoleIds.map((roleId) => `<@&${roleId}>`),
        ]
          .filter(Boolean)
          .join(' ')

        const message = await textChannel.send({
          content: mentions,
          embeds: [welcome],
          allowedMentions: {
            parse: [],
            users: [clickerId],
            roles: staffRoleIds,
          },
        })
        welcomeMessageId = message.id

        const record = await Ticket.create({
          guildId,
          channelId: textChannel.id,
          number,
          openerId: clickerId,
          optionId: option.id,
          optionName: option.name,
          status: 'open',
          welcomeMessageId: message.id,
        })
        ticketId = String(record._id)

        await reactionManager.bind(
          { id: message.id },
          {
            client,
            channelId: textChannel.id,
            guildId,
            keys: [closeKey(this.closeSettings(config).emoji)],
            permanent: true,
          },
        )

        await this.log(
          client,
          config,
          Embed({
            title: t('commands.ticket.log.open.title'),
            description: [
              t('commands.ticket.log.open.number', number),
              t('commands.ticket.log.open.channel', textChannel.id),
              t(
                'commands.ticket.log.open.opener',
                formatTicketUserTag(member, t),
              ),
              t('commands.ticket.log.open.type', option.name),
            ],
            color: colors.success,
            thumbnail: images.plus,
          }),
        )
      } catch (error) {
        logger.error('[Ticket] failed to open a ticket', error)

        if (welcomeMessageId) {
          await reactionManager
            .unbind(client, welcomeMessageId, { clearReactions: false })
            .catch((cleanupError) =>
              logger.error(
                '[Ticket] failed to unbind an unsuccessful ticket',
                cleanupError,
              ),
            )
        }
        let channelRemoved = !created
        if (created) {
          try {
            await created.delete()
            channelRemoved = true
          } catch (cleanupError) {
            logger.error(
              '[Ticket] failed to roll back the ticket channel',
              cleanupError,
            )
          }
        }
        if (ticketId !== null && channelRemoved) {
          await Ticket.deleteOne({ _id: ticketId }).catch((cleanupError) =>
            logger.error(
              '[Ticket] failed to roll back the ticket record',
              cleanupError,
            ),
          )
        }

        await feedback(t('commands.ticket.open.failedNotice.description'))
        await this.log(
          client,
          config,
          Embed({
            title: t('commands.ticket.log.openFailed.title'),
            description: t('commands.ticket.log.openFailed.description'),
            color: colors.danger,
            thumbnail: images.less,
          }),
        )
        return
      }
      await feedback(t('commands.ticket.open.created', created.id), true)
    } catch (error) {
      logger.error('[Ticket] failed to prepare ticket opening', error)
      await feedback(t('commands.ticket.open.failedNotice.description'))
    } finally {
      this.opening.delete(openingKey)
    }
  }

  async closeFromReaction(ctx: ReactionContext): Promise<void> {
    const { guildId, clickerId, client, channelId } = ctx
    if (!guildId) return
    const t = i18n.getTranslator()
    try {
      const ticket = await findTicketByChannel(guildId, channelId)
      if (!ticket || ticket.status !== 'open') return

      await this.closeTicket({
        client,
        rest: client.rest,
        guildId,
        channelId,
        actorId: clickerId,
        reason: null,
        t,
        context: null,
      })
    } catch (error) {
      logger.error('[Ticket] close reaction failed', error)
      await sendTemporaryMessage(
        client.rest,
        channelId,
        ticketFeedback(t, clickerId, t('commands.ticket.action.failed')),
        TEMP_MESSAGE_MS,
      )
    }
  }

  async close(ctx: CommandContext): Promise<void> {
    const { guildId, channelId, author, args, t } = ctx
    if (!guildId) return

    const ticket = await findTicketByChannel(guildId, channelId)
    if (!ticket) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.notTicketChannel.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    if (ticket.status !== 'open') {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.close.notOpen.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const reason = args.slice(1).join(' ').trim() || null

    await this.closeTicket({
      client: ctx.client,
      rest: ctx.client.rest,
      guildId,
      channelId,
      actorId: author.id,
      reason,
      t,
      context: ctx,
    })
  }

  private queueCloseDm(input: CloseDmInput | null): void {
    if (!input) return
    void this.sendCloseDm(input)
  }

  private formatDuration(t: TranslateFunction, ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const parts: string[] = []

    if (days) parts.push(t('common.duration.days', days))
    if (hours) parts.push(t('common.duration.hours', hours))
    if (minutes) parts.push(t('common.duration.minutes', minutes))
    if (seconds && !days && !hours)
      parts.push(t('common.duration.seconds', seconds))
    if (!parts.length) parts.push(t('common.duration.seconds', 0))

    return parts.slice(0, 2).join(` ${t('common.and')} `)
  }

  private async sendCloseDm(input: CloseDmInput): Promise<void> {
    try {
      const { client, guildId, ticket, actorId, reason, closedAt } = input
      const [guild, opener, actor] = await Promise.all([
        client.guilds.fetch(guildId).catch(() => null),
        client.users.fetch(ticket.openerId).catch(() => null),
        client.users.fetch(actorId).catch(() => null),
      ])

      if (!opener || opener.bot) {
        if (!opener)
          logger.debug(
            '[Ticket] could not fetch the ticket opener for the close DM',
            ticket.openerId,
          )
        return
      }

      const t = i18n.getTranslator()
      const serverName =
        guild?.name ?? t('commands.ticket.closeDm.unknownServer')
      const openedAt = ticket.createdAt
        ? new Date(ticket.createdAt)
        : ticket._id.getTimestamp()
      const type = ticket.optionName ?? t('commands.ticket.closeDm.unknownType')
      const closedByTag = formatTicketUserTag(actor ?? { id: actorId }, t)
      const description = [
        t('commands.ticket.closeDm.description', serverName),
        t('commands.ticket.closeDm.ticket', ticket.number, type),
        t('commands.ticket.closeDm.closedBy', closedByTag),
        t(
          'commands.ticket.closeDm.openedAt',
          `<t:${Math.floor(openedAt.getTime() / 1000)}:f>`,
        ),
        t(
          'commands.ticket.closeDm.closedAt',
          `<t:${Math.floor(closedAt.getTime() / 1000)}:f>`,
        ),
        t(
          'commands.ticket.closeDm.duration',
          this.formatDuration(t, closedAt.getTime() - openedAt.getTime()),
        ),
        ...(reason ? [t('commands.ticket.closeDm.reason', reason)] : []),
      ].join('\n')

      await opener.send({
        embeds: [
          Embed({
            author: {
              name: serverName,
              iconUrl: guild?.iconURL({ size: 256 }) ?? undefined,
            },
            title: t('commands.ticket.closeDm.title'),
            description,
            color: colors.primary,
            thumbnail: serverIconUrl(guild),
            footer: {
              text: t('commands.ticket.closeDm.footer'),
            },
          }),
        ],
        allowedMentions: { parse: [] },
      })
    } catch (error) {
      logger.debug('[Ticket] failed to send the close DM', error)
    }
  }

  private async authorizeClose(
    input: CloseInput,
    ticket: TicketRecord,
    config: TicketConfig | null,
  ): Promise<boolean> {
    const { rest, guildId, channelId, actorId, t, context } = input
    const staff = await isStaffMember(rest, guildId, actorId, config)
    const opener = ticket.openerId === actorId

    if (!staff && !(opener && this.closeSettings(config).openerCanClose)) {
      const description = t('commands.ticket.close.onlyStaff.description')
      if (context) {
        await context.reply({
          content: `${botConfig.separator(emojis.error)} ${description}`,
          allowedMentions: { parse: [] },
        })
      } else {
        await sendTemporaryMessage(
          rest,
          channelId,
          ticketFeedback(t, actorId, description),
          TEMP_MESSAGE_MS,
        )
      }
      return false
    }
    return true
  }

  private async closeTicket(input: CloseInput): Promise<void> {
    const { client, rest, guildId, channelId, actorId, reason, t, context } =
      input

    const config = await loadTicketConfig(guildId)
    const ticket = await findTicketByChannel(guildId, channelId)
    if (!ticket) return
    if (!(await this.authorizeClose(input, ticket, config))) return
    const settings = this.closeSettings(config)

    if (this.closing.has(channelId)) {
      await sendTemporaryMessage(
        rest,
        channelId,
        ticketFeedback(
          t,
          actorId,
          t('commands.ticket.close.alreadyClosing.description'),
        ),
        DELAY_MESSAGE_MS,
      )
      return
    }

    this.closing.add(channelId)

    try {
      if (
        !(await this.ensureBotPermissions(
          client,
          guildId,
          TICKET_MANAGE_PERMISSIONS,
          {
            t,
            context,
            noticeChannelId: channelId,
            config,
            actorId,
          },
        ))
      ) {
        return
      }

      if (settings.delay > 0) {
        await sendTemporaryMessage(
          rest,
          channelId,
          ticketFeedback(
            t,
            actorId,
            t('commands.ticket.close.delayMessage.description', settings.delay),
            true,
          ),
          Math.max(DELAY_MESSAGE_MS, settings.delay * 1000),
        )
        await sleep(settings.delay * 1000)
      }

      const fresh = await findTicketByChannel(guildId, channelId)
      if (!fresh || fresh.status !== 'open') {
        await sendTemporaryMessage(
          rest,
          channelId,
          ticketFeedback(
            t,
            actorId,
            t('commands.ticket.close.alreadyClosed.description'),
          ),
          DELAY_MESSAGE_MS,
        )
        return
      }

      const channel = await this.fetchGuildChannel(client, guildId, channelId)

      const closedAt = new Date()
      const openerTag = await getUserTag(client, fresh.openerId)
      const closerTag = await getUserTag(client, actorId)
      const currentConfig = await loadTicketConfig(guildId)
      if (!(await this.authorizeClose(input, fresh, currentConfig))) return
      const closeDm = settings.dm
        ? {
            client,
            guildId,
            ticket: fresh,
            actorId,
            reason,
            closedAt,
          }
        : null

      if (settings.action === 'delete') {
        if (!channel) {
          let recordDeleted = false
          for (let attempt = 0; attempt < 3 && !recordDeleted; attempt += 1) {
            try {
              await Ticket.deleteOne({ _id: fresh._id })
              recordDeleted = true
            } catch (error) {
              logger.error('[Ticket] failed to delete the ticket record', error)
              await sleep(100)
            }
          }
          this.queueCloseDm(closeDm)
          return
        }

        const deleted = await channel
          .delete()
          .then(() => true)
          .catch((error) => {
            logger.error('[Ticket] failed to delete the ticket channel', error)
            return false
          })

        if (!deleted) {
          await sendTemporaryMessage(
            rest,
            channelId,
            ticketFeedback(
              t,
              actorId,
              t('commands.ticket.close.deleteFailed.description'),
            ),
            STAFF_NOTICE_MS,
          )
          await this.log(
            client,
            config,
            Embed({
              title: t('commands.ticket.close.deleteFailed.title'),
              description: t('commands.ticket.close.deleteFailed.description'),
              color: colors.danger,
            }),
          )
          return
        }

        if (fresh.welcomeMessageId) {
          await reactionManager
            .unbind(client, fresh.welcomeMessageId, { clearReactions: false })
            .catch(() => {})
        }
        let recordDeleted = false
        for (let attempt = 0; attempt < 3 && !recordDeleted; attempt += 1) {
          try {
            await Ticket.deleteOne({ _id: fresh._id })
            recordDeleted = true
          } catch (error) {
            logger.error('[Ticket] failed to delete the ticket record', error)
            await sleep(100)
          }
        }

        this.queueCloseDm(closeDm)

        await this.log(
          client,
          config,
          this.closeLog(
            t,
            config,
            fresh,
            actorId,
            reason,
            openerTag,
            closerTag,
          ),
        )
        return
      }

      if (!channel) {
        let recordDeleted = false
        for (let attempt = 0; attempt < 3 && !recordDeleted; attempt += 1) {
          try {
            await Ticket.deleteOne({ _id: fresh._id })
            recordDeleted = true
          } catch (error) {
            logger.error('[Ticket] failed to delete the ticket record', error)
            await sleep(100)
          }
        }
        this.queueCloseDm(closeDm)
        await this.log(
          client,
          config,
          this.closeLog(
            t,
            config,
            fresh,
            actorId,
            reason,
            openerTag,
            closerTag,
          ),
        )
        return
      }

      if (config?.closedCategoryId) {
        const category = await this.fetchGuildChannel(
          client,
          guildId,
          config.closedCategoryId,
        )
        if (category?.isCategory()) {
          await channel.edit({ parentId: category.id }).catch((error) => {
            logger.error('[Ticket] failed to move the ticket channel', error)
          })
        }
      }

      for (const userId of [fresh.openerId, ...fresh.addedUserIds]) {
        if (!userId) continue
        await channel.permissionOverwrites.delete(userId)
      }

      await Ticket.updateOne(
        { _id: fresh._id },
        {
          $set: {
            status: 'closed',
            closedById: actorId,
            closedAt,
            welcomeMessageId: null,
          },
        },
      )

      this.queueCloseDm(closeDm)

      if (fresh.welcomeMessageId) {
        await reactionManager
          .unbind(client, fresh.welcomeMessageId)
          .catch((error) =>
            logger.error('[Ticket] failed to unbind the close reaction', error),
          )
      }

      if (channel.isText()) {
        for (const message of ticketFeedbackPages(
          t,
          actorId,
          [
            t('commands.ticket.close.archived.description'),
            reason ? t('commands.ticket.close.reasonLine', reason) : '',
          ].filter(Boolean),
          true,
        )) {
          await channel
            .send(message)
            .catch((error) =>
              logger.error(
                '[Ticket] failed to send the archive message',
                error,
              ),
            )
        }
      }

      await this.log(
        client,
        config,
        this.closeLog(t, config, fresh, actorId, reason, openerTag, closerTag),
      )
    } finally {
      this.closing.delete(channelId)
    }
  }

  private closeLog(
    t: TranslateFunction,
    config: TicketConfig | null,
    ticket: TicketRecord,
    actorId: string,
    reason: string | null,
    openerTag: string,
    closerTag: string,
  ) {
    const settings = this.closeSettings(config)

    return Embed({
      title: t('commands.ticket.log.close.title'),
      description: [
        t('commands.ticket.log.close.number', ticket.number),
        t('commands.ticket.log.close.channel', ticket.channelId),
        t('commands.ticket.log.close.opener', openerTag),
        t('commands.ticket.log.close.closedBy', closerTag),
        t('commands.ticket.log.close.type', ticket.optionName ?? '-'),
        t(
          'commands.ticket.log.close.action',
          t(
            settings.action === 'delete'
              ? 'commands.ticket.config.closeActionDelete'
              : 'commands.ticket.config.closeActionArchive',
          ),
        ),
        reason ? t('commands.ticket.log.close.reason', reason) : '',
      ].filter(Boolean),
      color: colors.danger,
      thumbnail: images.less,
    })
  }

  async reopen(ctx: CommandContext): Promise<void> {
    const { guildId, args, t } = ctx
    if (!guildId) return

    const raw = args[1]
    if (args.length === 1) return replyUsage(ctx, 'reopen')
    const channelId = parseChannelId(raw)
    const number = raw && /^\d+$/.test(raw) ? Number(raw) : null
    if (!channelId && number === null) {
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.usage.errors.invalidTicketReference'),
      )
    }

    const config = await loadTicketConfig(guildId)
    if (
      !(await isStaffMember(ctx.client.rest, guildId, ctx.author.id, config))
    ) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.staffOnly.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const ticket = (await Ticket.findOne(
      channelId ? { guildId, channelId } : { guildId, number },
    ).lean()) as TicketRecord | null

    if (!ticket) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.reopen.notFound.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    if (ticket.status === 'open') {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.reopen.alreadyOpen.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    if (
      !(await this.ensureBotPermissions(
        ctx.client,
        guildId,
        TICKET_MANAGE_PERMISSIONS,
        {
          t,
          context: ctx,
          noticeChannelId: ticket.channelId,
          config,
          actorId: ctx.author.id,
        },
      ))
    ) {
      return
    }

    const channel = await this.fetchGuildChannel(
      ctx.client,
      guildId,
      ticket.channelId,
    )
    if (!channel) {
      await Ticket.deleteOne({ _id: ticket._id }).catch(() => {})
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.reopen.channelMissing.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    if (config?.openCategoryId) {
      const category = await this.fetchGuildChannel(
        ctx.client,
        guildId,
        config.openCategoryId,
      )
      if (category?.isCategory()) {
        await channel
          .edit({ parentId: category.id })
          .catch((error) =>
            logger.error('[Ticket] failed to move the reopened ticket', error),
          )
      }
    }

    for (const userId of [ticket.openerId, ...ticket.addedUserIds]) {
      if (!userId) continue
      await channel.permissionOverwrites.edit(userId, {
        type: OverwriteType.Member,
        allow: TICKET_MEMBER_PERMISSIONS,
      })
    }

    await Ticket.updateOne(
      { _id: ticket._id },
      {
        $set: {
          status: 'open',
          reopenedAt: new Date(),
          closedById: null,
          closedAt: null,
        },
      },
    )

    const other = (await Ticket.findOne({
      guildId,
      openerId: ticket.openerId,
      status: 'open',
      channelId: { $ne: ticket.channelId },
    }).lean()) as TicketRecord | null

    const openerTag = await getUserTag(ctx.client, ticket.openerId)
    const actorTag = await getUserTag(ctx.client, ctx.author.id)

    let announced = false
    if (channel.isText()) {
      const content = [
        t('commands.ticket.reopen.notice.description', `<@${ticket.openerId}>`),
        other
          ? t(
              'commands.ticket.reopen.otherOpen',
              `<@${ticket.openerId}>`,
              (config?.staffRoleIds ?? []).map((id) => `<@&${id}>`).join(' '),
            )
          : '',
      ]
        .filter(Boolean)
        .join('\n')

      const message = await channel
        .send(
          ticketFeedback(t, ctx.author.id, content, true, {
            users: [ticket.openerId],
            roles: other ? (config?.staffRoleIds ?? []) : [],
          }),
        )
        .catch((error) => {
          logger.error('[Ticket] failed to announce the reopen', error)
          return null
        })

      if (message) {
        announced = true
        await reactionManager
          .bind(
            { id: message.id },
            {
              client: ctx.client,
              channelId: channel.id,
              guildId,
              keys: [closeKey(this.closeSettings(config).emoji)],
              permanent: true,
            },
          )
          .catch((error) =>
            logger.error('[Ticket] failed to bind the close reaction', error),
          )

        await Ticket.updateOne(
          { _id: ticket._id },
          { $set: { welcomeMessageId: message.id } },
        )
      }
    }

    await this.log(
      ctx.client,
      config,
      Embed({
        title: t('commands.ticket.log.reopen.title'),
        description: [
          t('commands.ticket.log.reopen.number', ticket.number),
          t('commands.ticket.log.reopen.channel', ticket.channelId),
          t('commands.ticket.log.reopen.opener', openerTag),
          t('commands.ticket.log.reopen.by', actorTag),
        ],
        color: colors.success,
      }),
    )

    if (ctx.channelId !== ticket.channelId || !announced) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.success)} ${t('commands.ticket.reopen.success.description', ticket.number)}`,
        allowedMentions: { parse: [] },
      })
    }
  }

  async add(ctx: CommandContext): Promise<void> {
    const { guildId, channelId, author, args, t } = ctx
    if (!guildId) return
    if (args.length === 1) return replyUsage(ctx, 'add')

    const ticket = await findTicketByChannel(guildId, channelId)
    if (!ticket) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.notTicketChannel.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const config = await loadTicketConfig(guildId)
    if (!(await isStaffMember(ctx.client.rest, guildId, author.id, config))) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.staffOnly.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const userId = parseUserId(args[1])
    if (!userId) {
      await ctx.reply({
        content: t('common.invalid.messages.user'),
        allowedMentions: { parse: [] },
      })
      return
    }

    const member = await fetchMember(ctx.client.rest, guildId, userId)
    if (!member) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.add.notMember')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const channel = await this.fetchGuildChannel(
      ctx.client,
      guildId,
      ticket.channelId,
    )
    if (!channel) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.notTicketChannel.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const targetIsStaff = await isStaffMember(
      ctx.client.rest,
      guildId,
      userId,
      config,
    )

    if (
      !(await this.ensureBotPermissions(
        ctx.client,
        guildId,
        TICKET_MANAGE_PERMISSIONS,
        {
          t,
          context: ctx,
          noticeChannelId: channel.id,
          config,
          actorId: author.id,
        },
      ))
    ) {
      return
    }

    await channel.permissionOverwrites.edit(userId, {
      type: OverwriteType.Member,
      allow: TICKET_MEMBER_PERMISSIONS,
    })

    if (userId !== ticket.openerId && !targetIsStaff) {
      await Ticket.updateOne(
        { _id: ticket._id },
        { $addToSet: { addedUserIds: userId } },
      )
    }

    await ctx.reply({
      content: `${botConfig.separator(emojis.success)} ${t('commands.ticket.add.success', `<@${userId}>`)}`,
      allowedMentions: { parse: [] },
    })
  }

  async remove(ctx: CommandContext): Promise<void> {
    const { guildId, channelId, author, args, t } = ctx
    if (!guildId) return
    if (args.length === 1) return replyUsage(ctx, 'remove')

    const ticket = await findTicketByChannel(guildId, channelId)
    if (!ticket) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.notTicketChannel.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const config = await loadTicketConfig(guildId)
    if (!(await isStaffMember(ctx.client.rest, guildId, author.id, config))) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.staffOnly.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const userId = parseUserId(args[1])
    if (!userId) {
      await ctx.reply({
        content: t('common.invalid.messages.user'),
        allowedMentions: { parse: [] },
      })
      return
    }

    if (userId === ticket.openerId) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.remove.opener')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    if (userId === ctx.client.user?.id) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.remove.bot')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    if (await isStaffMember(ctx.client.rest, guildId, userId, config)) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.remove.staff')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const channel = await this.fetchGuildChannel(
      ctx.client,
      guildId,
      ticket.channelId,
    )
    if (!channel) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.notTicketChannel.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    if (
      !(await this.ensureBotPermissions(
        ctx.client,
        guildId,
        TICKET_MANAGE_PERMISSIONS,
        {
          t,
          context: ctx,
          noticeChannelId: channel.id,
          config,
          actorId: author.id,
        },
      ))
    ) {
      return
    }

    await channel.permissionOverwrites.delete(userId)
    await Ticket.updateOne(
      { _id: ticket._id },
      { $pull: { addedUserIds: userId } },
    )

    await ctx.reply({
      content: `${botConfig.separator(emojis.success)} ${t('commands.ticket.remove.success', `<@${userId}>`)}`,
      allowedMentions: { parse: [] },
    })
  }

  async transfer(ctx: CommandContext): Promise<void> {
    const { guildId, channelId, author, args, t } = ctx
    if (!guildId) return
    if (args.length === 1) return replyUsage(ctx, 'transfer')

    const ticket = await findTicketByChannel(guildId, channelId)
    if (!ticket) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.notTicketChannel.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const config = await loadTicketConfig(guildId)
    if (!(await isStaffMember(ctx.client.rest, guildId, author.id, config))) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.staffOnly.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const userId = parseUserId(args[1])
    if (!userId) {
      await ctx.reply({
        content: t('common.invalid.messages.user'),
        allowedMentions: { parse: [] },
      })
      return
    }

    const member = await fetchMember(ctx.client.rest, guildId, userId)
    if (!member) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.transfer.notMember')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    if (!(await isStaffMember(ctx.client.rest, guildId, userId, config))) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.transfer.notStaff')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    const channel = await this.fetchGuildChannel(
      ctx.client,
      guildId,
      ticket.channelId,
    )
    if (!channel) {
      await ctx.reply({
        content: `${botConfig.separator(emojis.error)} ${t('commands.ticket.notTicketChannel.description')}`,
        allowedMentions: { parse: [] },
      })
      return
    }

    if (
      !(await this.ensureBotPermissions(
        ctx.client,
        guildId,
        TICKET_MANAGE_PERMISSIONS,
        {
          t,
          context: ctx,
          noticeChannelId: channel.id,
          config,
          actorId: author.id,
        },
      ))
    ) {
      return
    }

    await channel.permissionOverwrites.edit(userId, {
      type: OverwriteType.Member,
      allow: TICKET_MEMBER_PERMISSIONS,
    })

    await Ticket.updateOne(
      { _id: ticket._id },
      {
        $set: { assigneeId: userId },
        $pull: { addedUserIds: userId },
      },
    )

    const authorTag = await getUserTag(ctx.client, author.id)
    const targetTag = await getUserTag(ctx.client, userId)

    await this.log(
      ctx.client,
      config,
      Embed({
        title: t('commands.ticket.log.transfer.title'),
        description: [
          t('commands.ticket.log.transfer.number', ticket.number),
          t('commands.ticket.log.transfer.channel', ticket.channelId),
          t('commands.ticket.log.transfer.from', authorTag),
          t('commands.ticket.log.transfer.to', targetTag),
        ],
        color: colors.primary,
      }),
    )

    await ctx.reply({
      content: `${botConfig.separator(emojis.success)} ${t('commands.ticket.transfer.success', `<@${userId}>`)}`,
      allowedMentions: { parse: [] },
    })
  }
}

export const ticketActionManager = new TicketActionManager()
