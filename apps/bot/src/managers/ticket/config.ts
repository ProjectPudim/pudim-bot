import {
  DEFAULT_TICKET_NAME_PATTERN,
  TICKET_CLOSE_ACTIONS,
  TicketConfig,
  type TicketCloseAction,
  type TicketOption,
} from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import { colors, config, emojis } from '#bot/config'
import { parseChannelId, parseRoleId } from '#bot/utils'
import {
  Embed,
  mergeEmbed,
  parseEmbed,
  type EmbedJson,
  type ParseEmbedError,
} from '#bot/utils/embed'
import { parseEmoji } from '#bot/utils/emojis'
import {
  embedPayload,
  fetchMember,
  loadTicketConfig,
  parseUserId,
  requireManager,
  TICKET_NAME_VARIABLE_LIST,
  validateTicketNamePattern,
} from './helpers'
import {
  replyTicketUsageError,
  replyUsage,
  WELCOME_EMBED_EXCLUDE,
} from './usage'
import {
  defaultWelcomeEmbed,
  findUnknownWelcomeVariables,
  renderWelcomeEmbed,
} from './welcome'

type ChannelFailure = 'notFound' | 'invalid' | 'cannotSend'

const ON = ['on', 'ativar', 'true', 'sim']
const OFF = ['off', 'desativar', 'false', 'nao', 'não']

export class TicketConfigManager {
  private async reply(
    ctx: CommandContext,
    _title: string,
    description: string,
    color: string,
  ) {
    await ctx.reply({
      content: `${config.separator(color === colors.success ? emojis.success : emojis.error)} ${description}`,
      allowedMentions: { parse: [] },
    })
  }

  private async error(ctx: CommandContext, title: string, description: string) {
    await this.reply(ctx, title, description, colors.danger)
  }

  private async replyEmbedError(ctx: CommandContext, error: ParseEmbedError) {
    const params = error.params.map((p) => `\`${p}\``).join(', ')
    await replyTicketUsageError(
      ctx,
      ctx.t(`errors.embed.${error.code}`, params),
    )
  }

  private async checkTextChannel(
    ctx: CommandContext,
    channelId: string,
  ): Promise<ChannelFailure | null> {
    const channel = await ctx.client.channels.fetch(channelId).catch(() => null)

    if (!channel || !channel.isGuild() || channel.guildId !== ctx.guildId) {
      return 'notFound'
    }
    if (!channel.isText() && !channel.isAnnouncement()) return 'invalid'
    if (!(await channel.canSend().catch(() => false))) return 'cannotSend'

    return null
  }

  private channelFailureMessage(
    ctx: CommandContext,
    failure: ChannelFailure,
  ): string {
    return ctx.t(`commands.ticket.channel.${failure}`)
  }

  async command(ctx: CommandContext): Promise<void> {
    const { args } = ctx
    if (!ctx.guildId) return

    if (!(await requireManager(ctx))) return

    const sub = args[0]?.toLowerCase()

    switch (sub) {
      case 'channel':
        return this.setChannel(ctx, args[1])
      case 'category':
        return this.setCategory(ctx, args[1], args[2])
      case 'close':
        return this.closeSettings(ctx, args.slice(1))
      case 'staffrole':
        return this.staffRole(ctx, args.slice(1))
      case 'logchannel':
        return this.setLogChannel(ctx, args[1])
      case 'namepattern':
        return this.setNamePattern(ctx, args.slice(1).join(' '))
      case 'welcome':
        return this.setWelcome(ctx, args.slice(1))
      case 'blacklist':
        return this.blacklist(ctx, args.slice(1))
      case 'config':
        if (args.length > 1) {
          return replyTicketUsageError(
            ctx,
            ctx.t(
              'commands.ticket.usage.errors.unexpectedArguments',
              'ticket config',
            ),
          )
        }
        return this.showConfig(ctx)
    }
  }

  private async setChannel(ctx: CommandContext, raw?: string): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    if (raw === undefined) return replyUsage(ctx, 'channel')
    const channelId = parseChannelId(raw)
    if (!channelId)
      return replyTicketUsageError(ctx, t('commands.ticket.channel.notFound'))

    const failure = await this.checkTextChannel(ctx, channelId)
    if (failure) {
      await this.error(
        ctx,
        t('errors.invalidArgument'),
        this.channelFailureMessage(ctx, failure),
      )
      return
    }

    await TicketConfig.updateOne(
      { guildId },
      { $set: { channelId } },
      { upsert: true },
    )

    await this.reply(
      ctx,
      t('commands.ticket.channel.title'),
      t('commands.ticket.channel.description', channelId),
      colors.success,
    )
  }

  private async setLogChannel(
    ctx: CommandContext,
    raw?: string,
  ): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    if (raw === undefined) return replyUsage(ctx, 'logchannel')
    const channelId = parseChannelId(raw)
    if (!channelId)
      return replyTicketUsageError(ctx, t('commands.ticket.channel.notFound'))

    const failure = await this.checkTextChannel(ctx, channelId)
    if (failure) {
      await this.error(
        ctx,
        t('errors.invalidArgument'),
        this.channelFailureMessage(ctx, failure),
      )
      return
    }

    await TicketConfig.updateOne(
      { guildId },
      { $set: { logChannelId: channelId } },
      { upsert: true },
    )

    await this.reply(
      ctx,
      t('commands.ticket.logchannel.title'),
      t('commands.ticket.logchannel.description', channelId),
      colors.success,
    )
  }

  private async setCategory(
    ctx: CommandContext,
    raw: string | undefined,
    target: string | undefined,
  ): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    if (raw === undefined && target === undefined)
      return replyUsage(ctx, 'category')
    const categoryId = parseChannelId(raw)
    const kind = target?.toLowerCase()
    if (!categoryId)
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.category.notCategory'),
      )
    if (!kind)
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.usage.errors.missingCategoryTarget'),
      )
    if (kind !== 'open' && kind !== 'closed')
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.usage.errors.invalidCategoryTarget'),
      )

    const category = await ctx.client.channels
      .fetch(categoryId)
      .catch(() => null)

    if (
      !category ||
      !category.isGuild() ||
      category.guildId !== guildId ||
      !category.isCategory()
    ) {
      await this.error(
        ctx,
        t('errors.invalidArgument'),
        t(
          category
            ? 'commands.ticket.category.notCategory'
            : 'commands.ticket.category.notFound',
        ),
      )
      return
    }

    const field = kind === 'open' ? 'openCategoryId' : 'closedCategoryId'

    await TicketConfig.updateOne(
      { guildId },
      { $set: { [field]: categoryId } },
      { upsert: true },
    )

    await this.reply(
      ctx,
      t('commands.ticket.category.title'),
      t(
        kind === 'open'
          ? 'commands.ticket.category.openSaved'
          : 'commands.ticket.category.closedSaved',
        category.name ?? categoryId,
      ),
      colors.success,
    )
  }

  private async closeSettings(
    ctx: CommandContext,
    args: string[],
  ): Promise<void> {
    const sub = args[0]?.toLowerCase()

    switch (sub) {
      case 'action':
        return this.setCloseAction(ctx, args[1])
      case 'delay':
        return this.setCloseDelay(ctx, args[1])
      case 'emoji':
        return this.setCloseEmoji(ctx, args[1])
      case 'opener':
        return this.setOpenerCanClose(ctx, args[1])
      case 'dm':
        return this.setCloseDm(ctx, args[1])
    }
  }

  private async setCloseAction(
    ctx: CommandContext,
    raw?: string,
  ): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    if (raw === undefined) return replyUsage(ctx, 'close.action')
    const action = raw.toLowerCase()
    if (
      !action ||
      !(TICKET_CLOSE_ACTIONS as readonly string[]).includes(action)
    ) {
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.usage.errors.invalidCloseAction'),
      )
    }

    await TicketConfig.updateOne(
      { guildId },
      { $set: { 'close.action': action } },
      { upsert: true },
    )

    await this.reply(
      ctx,
      t('commands.ticket.close.action.title'),
      t(`commands.ticket.close.action.${action as TicketCloseAction}`),
      colors.success,
    )
  }

  private async setCloseDelay(
    ctx: CommandContext,
    raw?: string,
  ): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    if (raw === undefined) return replyUsage(ctx, 'close.delay')
    const delay = raw && /^\d+$/.test(raw) ? Number(raw) : Number.NaN
    if (!Number.isInteger(delay) || delay < 0 || delay > 30) {
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.usage.errors.invalidCloseDelay'),
      )
    }

    await TicketConfig.updateOne(
      { guildId },
      { $set: { 'close.delay': delay } },
      { upsert: true },
    )

    await this.reply(
      ctx,
      t('commands.ticket.close.delay.title'),
      t('commands.ticket.close.delay.saved', delay),
      colors.success,
    )
  }

  private async setCloseEmoji(
    ctx: CommandContext,
    raw?: string,
  ): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    if (raw === undefined) return replyUsage(ctx, 'close.emoji')
    const emoji = parseEmoji(raw)
    if (!emoji) {
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.option.invalidEmoji'),
      )
    }

    await TicketConfig.updateOne(
      { guildId },
      { $set: { 'close.emoji': emoji.display } },
      { upsert: true },
    )

    await this.reply(
      ctx,
      t('commands.ticket.close.emoji.title'),
      t('commands.ticket.close.emoji.saved', emoji.display),
      colors.success,
    )
  }

  private async setOpenerCanClose(
    ctx: CommandContext,
    raw?: string,
  ): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    if (raw === undefined) return replyUsage(ctx, 'close.opener')
    const value = raw.toLowerCase()
    const enabled = ON.includes(value)
      ? true
      : OFF.includes(value)
        ? false
        : null

    if (enabled === null) {
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.usage.errors.invalidToggle'),
      )
    }

    await TicketConfig.updateOne(
      { guildId },
      { $set: { 'close.openerCanClose': enabled } },
      { upsert: true },
    )

    await this.reply(
      ctx,
      t('commands.ticket.close.opener.title'),
      t(
        enabled
          ? 'commands.ticket.close.opener.enabled'
          : 'commands.ticket.close.opener.disabled',
      ),
      colors.success,
    )
  }

  private async setCloseDm(ctx: CommandContext, raw?: string): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    if (raw === undefined) return replyUsage(ctx, 'close.dm')
    const value = raw.toLowerCase()
    const enabled = ON.includes(value)
      ? true
      : OFF.includes(value)
        ? false
        : null

    if (enabled === null) {
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.usage.errors.invalidToggle'),
      )
    }

    await TicketConfig.updateOne(
      { guildId },
      { $set: { 'close.dm': enabled } },
      { upsert: true },
    )

    await this.reply(
      ctx,
      t('commands.ticket.close.dm.title'),
      t(
        enabled
          ? 'commands.ticket.close.dm.enabled'
          : 'commands.ticket.close.dm.disabled',
      ),
      colors.success,
    )
  }

  private async staffRole(ctx: CommandContext, args: string[]): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    const mode = args[0]?.toLowerCase()
    if (!args.length) return replyUsage(ctx, 'staffrole')
    if (mode === 'list') {
      if (args.length > 1)
        return replyTicketUsageError(
          ctx,
          t(
            'commands.ticket.usage.errors.unexpectedArguments',
            'ticket staffrole list',
          ),
        )
      return this.listStaffRoles(ctx)
    }
    if (mode !== 'add' && mode !== 'remove')
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.usage.errors.invalidStaffAction'),
      )
    if (args[1] === undefined) return replyUsage(ctx, `staffrole.${mode}`)

    const roleId = parseRoleId(args[1])
    if (!roleId) {
      await ctx.reply({
        content: t('common.invalidRole'),
        allowedMentions: { parse: [] },
      })
      return
    }

    const roles = await ctx.client.guilds
      .fetch(guildId)
      .then((guild) => guild.fetchRoles())
      .catch(() => [])
    const role = roles.find((item) => item.id === roleId)
    if (!role || role.id === guildId) {
      await this.error(
        ctx,
        t('errors.invalidArgument'),
        t('commands.ticket.staffrole.notFound'),
      )
      return
    }

    const config = await loadTicketConfig(guildId)
    const staffRoleIds = config?.staffRoleIds ?? []

    if (mode === 'add') {
      if (staffRoleIds.includes(roleId)) {
        await this.error(
          ctx,
          t('errors.invalidArgument'),
          t('commands.ticket.staffrole.alreadyAdded', `<@&${roleId}>`),
        )
        return
      }
      if (staffRoleIds.length >= 10) {
        await this.error(
          ctx,
          t('errors.limitExceeded'),
          t('commands.ticket.staffrole.limit', 10),
        )
        return
      }

      await TicketConfig.updateOne(
        { guildId },
        { $addToSet: { staffRoleIds: roleId } },
        { upsert: true },
      )
    } else {
      if (!staffRoleIds.includes(roleId)) {
        await this.error(
          ctx,
          t('errors.notFound'),
          t('commands.ticket.staffrole.notFoundRole', `<@&${roleId}>`),
        )
        return
      }

      await TicketConfig.updateOne(
        { guildId },
        { $pull: { staffRoleIds: roleId } },
      )
    }

    await this.reply(
      ctx,
      t('commands.ticket.staffrole.title'),
      t(
        mode === 'add'
          ? 'commands.ticket.staffrole.added'
          : 'commands.ticket.staffrole.removed',
        `<@&${roleId}>`,
      ),
      colors.success,
    )
  }

  private async listStaffRoles(ctx: CommandContext): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    const config = await loadTicketConfig(guildId)
    const roleIds = config?.staffRoleIds ?? []
    const roles = await ctx.client.guilds
      .fetch(guildId)
      .then((guild) => guild.fetchRoles())
      .catch(() => [])
    const nameOf = (id: string) =>
      roles.find((role) => role.id === id)?.name ??
      t('commands.ticket.staffrole.notFound')

    const lines = roleIds.map((id) =>
      t('commands.ticket.staffrole.list.line', `<@&${id}>`, id, nameOf(id)),
    )

    await ctx.reply({
      embeds: [
        Embed({
          title: t('commands.ticket.staffrole.list.title'),
          description: roleIds.length
            ? [
                t('commands.ticket.staffrole.list.count', roleIds.length),
                '',
                ...lines,
              ].join('\n')
            : t('commands.ticket.staffrole.list.empty'),
          color: colors.primary,
        }),
      ],
      allowedMentions: { parse: [] },
    })
  }

  private async setNamePattern(
    ctx: CommandContext,
    raw: string,
  ): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    if (!raw.trim() && ctx.args.length === 1)
      return replyUsage(ctx, 'namepattern')

    const result = validateTicketNamePattern(raw)
    if (!result.ok) {
      if (result.error === 'empty') {
        return replyTicketUsageError(
          ctx,
          t('commands.ticket.usage.errors.emptyPattern'),
        )
      }

      let description: string
      if (result.error === 'unknown') {
        description = t(
          'commands.ticket.namepattern.unknown',
          result.variables.map((variable) => `\`${variable}\``).join(', '),
          TICKET_NAME_VARIABLE_LIST,
        )
      } else {
        description = t('commands.ticket.namepattern.tooLong', 100)
      }

      await this.error(ctx, t('errors.invalidArgument'), description)
      return
    }

    await TicketConfig.updateOne(
      { guildId },
      { $set: { namePattern: result.pattern } },
      { upsert: true },
    )

    await this.reply(
      ctx,
      t('commands.ticket.namepattern.title'),
      t('commands.ticket.namepattern.saved', result.pattern),
      colors.success,
    )
  }

  private async setWelcome(ctx: CommandContext, args: string[]): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    if (!args.length) return replyUsage(ctx, 'welcome')

    if (args[0]?.toLowerCase() === 'preview') {
      if (args.length > 1)
        return replyTicketUsageError(
          ctx,
          t(
            'commands.ticket.usage.errors.unexpectedArguments',
            'ticket welcome preview',
          ),
        )
      return this.previewWelcome(ctx)
    }

    const parsed = parseEmbed(args, [...WELCOME_EMBED_EXCLUDE], {
      partial: true,
    })
    if (parsed.error) {
      await this.replyEmbedError(ctx, parsed)
      return
    }

    const config = await loadTicketConfig(guildId)
    const current = config?.welcome?.embed as EmbedJson | null | undefined
    const result = mergeEmbed(current, parsed.embed)

    if (result.error) {
      await this.replyEmbedError(ctx, result)
      return
    }

    await TicketConfig.updateOne(
      { guildId },
      { $set: { 'welcome.embed': result.embed } },
      { upsert: true },
    )

    const unknown = findUnknownWelcomeVariables(result.embed)
    const warning = unknown.length
      ? unknown.map((variable) => `\`${variable}\``).join(', ')
      : ''

    await this.reply(
      ctx,
      t('commands.ticket.welcome.title'),
      t('commands.ticket.welcome.saved', ctx.prefix, warning),
      colors.success,
    )
  }

  private async previewWelcome(ctx: CommandContext): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    const config = await loadTicketConfig(guildId)
    const stored =
      (config?.welcome?.embed as EmbedJson | null | undefined) ?? null
    const source = stored ? { ...stored } : defaultWelcomeEmbed(t)

    if (!stored) {
      const note = t('commands.ticket.welcome.preview.defaultNote', ctx.prefix)
      source.description = [source.description, note]
        .filter(Boolean)
        .join('\n\n')
    }

    const type =
      config?.options?.[0]?.name ??
      t('commands.ticket.welcome.preview.exampleType')

    const resolved = renderWelcomeEmbed(source, {
      username: ctx.author.username,
      userId: ctx.author.id,
      ticketType: type,
      ticketNumber: 1,
      channelId: ctx.channelId,
      serverName: ctx.guild?.name ?? '',
      closeEmoji: config?.close?.emoji ?? '❌',
    })

    await ctx.reply({
      embeds: [embedPayload(resolved)],
      allowedMentions: { parse: [] },
    })
  }

  private async blacklist(ctx: CommandContext, args: string[]): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    const mode = args[0]?.toLowerCase()
    if (!args.length) return replyUsage(ctx, 'blacklist')
    if (mode !== 'add' && mode !== 'remove')
      return replyTicketUsageError(
        ctx,
        t('commands.ticket.usage.errors.invalidBlacklistAction'),
      )
    if (args[1] === undefined) return replyUsage(ctx, `blacklist.${mode}`)
    const userId = parseUserId(args[1])
    if (!userId) {
      await ctx.reply({
        content: t('common.invalid.messages.user'),
        allowedMentions: { parse: [] },
      })
      return
    }

    const config = await loadTicketConfig(guildId)
    const blacklist = config?.blacklist ?? []

    if (mode === 'add') {
      const member = await fetchMember(ctx.client.rest, guildId, userId)
      if (!member) {
        await this.error(
          ctx,
          t('errors.invalidUser'),
          t('commands.ticket.blacklist.notMember'),
        )
        return
      }

      if (blacklist.includes(userId)) {
        await this.error(
          ctx,
          t('errors.invalidArgument'),
          t('commands.ticket.blacklist.alreadyAdded', `<@${userId}>`),
        )
        return
      }
      if (blacklist.length >= 200) {
        await this.error(
          ctx,
          t('errors.limitExceeded'),
          t('commands.ticket.blacklist.limit', 200),
        )
        return
      }

      await TicketConfig.updateOne(
        { guildId },
        { $addToSet: { blacklist: userId } },
        { upsert: true },
      )
    } else {
      if (!blacklist.includes(userId)) {
        await this.error(
          ctx,
          t('errors.notFound'),
          t('commands.ticket.blacklist.notFound', `<@${userId}>`),
        )
        return
      }

      await TicketConfig.updateOne(
        { guildId },
        { $pull: { blacklist: userId } },
      )
    }

    await this.reply(
      ctx,
      t('commands.ticket.blacklist.title'),
      t(
        mode === 'add'
          ? 'commands.ticket.blacklist.added'
          : 'commands.ticket.blacklist.removed',
        `<@${userId}>`,
      ),
      colors.success,
    )
  }

  private async showConfig(ctx: CommandContext): Promise<void> {
    const { guildId, t } = ctx
    if (!guildId) return

    const config = await loadTicketConfig(guildId)
    const notConfigured = t('commands.ticket.config.notConfigured')
    const yes = t('commands.ticket.config.yes')
    const no = t('commands.ticket.config.no')

    const panelChannel = config?.channelId
      ? `<#${config.channelId}>`
      : notConfigured

    const panelMessage =
      config?.panel?.channelId && config.panel.messageId
        ? t(
            'commands.ticket.config.panelSent',
            `https://web.fluxer.app/channels/${guildId}/${config.panel.channelId}/${config.panel.messageId}`,
          )
        : t('commands.ticket.config.panelNotSent')

    const action = config?.close?.action ?? 'archive'
    const actionLabel = t(
      action === 'delete'
        ? 'commands.ticket.config.closeActionDelete'
        : 'commands.ticket.config.closeActionArchive',
    )

    const options: TicketOption[] = (config?.options ?? []) as TicketOption[]
    const staffRoles = config?.staffRoleIds?.length
      ? config.staffRoleIds.map((id) => `<@&${id}>`).join(', ')
      : notConfigured

    const lines = [
      t('commands.ticket.config.panelChannel', panelChannel),
      t('commands.ticket.config.panelMessage', panelMessage),
      t(
        'commands.ticket.config.openCategory',
        config?.openCategoryId ? `<#${config.openCategoryId}>` : notConfigured,
      ),
      t(
        'commands.ticket.config.closedCategory',
        config?.closedCategoryId
          ? `<#${config.closedCategoryId}>`
          : notConfigured,
      ),
      t('commands.ticket.config.closeAction', actionLabel),
      t('commands.ticket.config.closeDelay', config?.close?.delay ?? 5),
      t('commands.ticket.config.closeEmoji', config?.close?.emoji ?? '❌'),
      t(
        'commands.ticket.config.openerCanClose',
        config?.close?.openerCanClose === false ? no : yes,
      ),
      t(
        'commands.ticket.config.closeDm',
        config?.close?.dm === false ? no : yes,
      ),
      t('commands.ticket.config.optionCount', options.length),
      t('commands.ticket.config.staffRoles', staffRoles),
      t(
        'commands.ticket.config.logChannel',
        config?.logChannelId ? `<#${config.logChannelId}>` : notConfigured,
      ),
      t(
        'commands.ticket.config.namePattern',
        config?.namePattern ?? DEFAULT_TICKET_NAME_PATTERN,
      ),
      t('commands.ticket.config.welcome', config?.welcome?.embed ? yes : no),
      t('commands.ticket.config.blacklist', config?.blacklist?.length ?? 0),
    ]

    await ctx.reply({
      embeds: [
        Embed({
          title: t('commands.ticket.config.title'),
          description: lines,
          color: colors.primary,
        }),
      ],
      allowedMentions: { parse: [] },
    })
  }
}

export const ticketConfigManager = new TicketConfigManager()
