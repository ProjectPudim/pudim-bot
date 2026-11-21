import type { Client } from '@fluxerjs/core'
import {
  TicketConfig,
  type TicketOption,
  type TicketPanelEmbed,
} from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import { config, emojis } from '#bot/config'
import { reactionManager } from '#bot/managers/reaction'
import {
  EMBED_LIMITS,
  mergeEmbed,
  parseEmbed,
  type ParseEmbedError,
} from '#bot/utils/embed'
import { logger } from '#bot/utils/logger'
import {
  embedPayload,
  missingPermissions,
  openKey,
  replyMissingBotPermissions,
  requireManager,
  TICKET_PANEL_PERMISSIONS,
  type TicketEmbedPayload,
} from './helpers'
import { PANEL_EMBED_EXCLUDE, replyTicketUsageError, replyUsage } from './usage'

const OPTIONS_MARKER = '{options}'

export type RefreshResult =
  | { status: 'notConfigured' | 'notSent' }
  | {
      status: 'ok' | 'messageNotFound' | 'failed' | 'descriptionTooLong'
      channelId: string
      messageId: string
    }

type SendableResult =
  | { ok: true; embed: TicketEmbedPayload }
  | { ok: false; error: 'descriptionTooLong' }

export class TicketPanelManager {
  /**
   * Converte o JSON guardado no banco em uma embed pronta para enviar.
   * A lista de opções só aparece quando a descrição contém `{options}`.
   */
  private toSendable(
    stored: NonNullable<TicketPanelEmbed>,
    options: readonly TicketOption[],
  ): SendableResult {
    const embed = { ...stored }
    const list = options
      .map((option) => `${option.emoji} ${option.name}`)
      .join('\n')

    if (embed.description?.includes(OPTIONS_MARKER)) {
      embed.description = embed.description.replaceAll(OPTIONS_MARKER, list)
    }

    if ([...(embed.description ?? '')].length > EMBED_LIMITS.description) {
      return { ok: false, error: 'descriptionTooLong' }
    }

    return {
      ok: true,
      embed: embedPayload(embed),
    }
  }

  private async load(guildId: string) {
    return TicketConfig.findOne({ guildId }).lean()
  }

  private async replyError(
    ctx: CommandContext,
    _title: string,
    description: string,
  ) {
    await ctx.reply({
      content: `${config.separator(emojis.error)} ${description}`,
      allowedMentions: { parse: [] },
    })
  }

  private async replyEmbedError(ctx: CommandContext, error: ParseEmbedError) {
    const params = error.params.map((p) => `\`${p}\``).join(', ')
    await replyTicketUsageError(
      ctx,
      ctx.t(`errors.embed.${error.code}`, params),
    )
  }

  private optionKeys(options: readonly TicketOption[]): string[] {
    return options.map((option) => openKey(option.emoji))
  }

  private async replyTooLong(ctx: CommandContext) {
    await this.replyError(
      ctx,
      ctx.t('commands.ticket.panel.tooLong.title'),
      ctx.t(
        'commands.ticket.panel.tooLong.description',
        EMBED_LIMITS.description,
      ),
    )
  }

  async preview(ctx: CommandContext) {
    const { guildId, t } = ctx
    if (!guildId) return

    const guild = await this.load(guildId)
    const stored = guild?.panel?.embed
    if (!stored) {
      await this.replyError(
        ctx,
        t('commands.ticket.panel.preview.notConfigured.title'),
        t(
          'commands.ticket.panel.preview.notConfigured.description',
          ctx.prefix,
        ),
      )
      return
    }

    const options: TicketOption[] = guild?.options ?? []
    const sendable = this.toSendable(stored, options)
    if (!sendable.ok) {
      await this.replyTooLong(ctx)
      return
    }

    await ctx.reply({
      embeds: [sendable.embed],
      allowedMentions: { parse: [] },
    })
  }

  async send(ctx: CommandContext) {
    const { guildId, t } = ctx
    if (!guildId) return

    const guild = await this.load(guildId)

    const channelId = guild?.channelId
    if (!channelId) {
      await this.replyError(
        ctx,
        t('commands.ticket.panel.send.channelNotConfigured.title'),
        t(
          'commands.ticket.panel.send.channelNotConfigured.description',
          ctx.prefix,
        ),
      )
      return
    }

    const stored = guild?.panel?.embed
    if (!stored) {
      await this.replyError(
        ctx,
        t('commands.ticket.panel.send.notConfigured.title'),
        t('commands.ticket.panel.send.notConfigured.description', ctx.prefix),
      )
      return
    }

    const options: TicketOption[] = guild?.options ?? []
    const sendable = this.toSendable(stored, options)
    if (!sendable.ok) {
      await this.replyTooLong(ctx)
      return
    }

    const botId = ctx.client.user?.id
    if (botId) {
      const missing = await missingPermissions(
        ctx.client.rest,
        guildId,
        botId,
        TICKET_PANEL_PERMISSIONS,
      )
      if (missing.length) {
        await replyMissingBotPermissions(ctx, missing)
        return
      }
    }

    const oldMessageId = guild?.panel?.messageId

    let message: Awaited<ReturnType<typeof ctx.client.channels.send>>
    try {
      message = await ctx.client.channels.send(channelId, {
        embeds: [sendable.embed],
        allowedMentions: { parse: [] },
      })
    } catch {
      await this.replyError(
        ctx,
        t('commands.ticket.panel.send.failed.title'),
        t('commands.ticket.panel.send.failed.description', channelId),
      )
      return
    }

    try {
      await TicketConfig.updateOne(
        { guildId },
        {
          $set: {
            'panel.channelId': message.channelId,
            'panel.messageId': message.id,
          },
        },
        { upsert: true },
      )

      const keys = this.optionKeys(options)
      if (keys.length) {
        await reactionManager.bind(
          { id: message.id },
          {
            client: ctx.client,
            channelId: message.channelId,
            guildId,
            keys,
            permanent: true,
          },
        )
      }
    } catch (error) {
      logger.error('[Ticket] failed to persist the panel', error)
      await ctx.client.channels
        .fetchMessage(message.channelId, message.id)
        .then((sent) => sent.delete())
        .catch(() => {})
      await this.replyError(
        ctx,
        t('commands.ticket.panel.send.failed.title'),
        t('commands.ticket.panel.send.failed.description', channelId),
      )
      return
    }

    if (oldMessageId && oldMessageId !== message.id) {
      await reactionManager
        .unbind(ctx.client, oldMessageId)
        .catch((error) =>
          logger.error('[Ticket] failed to unbind old panel', error),
        )
    }

    await ctx.reply({
      content: `${config.separator(emojis.success)} ${t(
        'commands.ticket.panel.send.success.description',
        guildId,
        message.channelId,
        message.id,
      )}`,
      allowedMentions: { parse: [] },
    })
  }

  /**
   * Edita o painel já enviado para refletir a embed e as opções salvas,
   * mantendo as reações sincronizadas pelo ReactionManager.
   * Não responde nada no chat: quem chama decide o que mostrar.
   */
  async refresh(ctx: CommandContext): Promise<RefreshResult> {
    const { guildId } = ctx
    if (!guildId) return { status: 'notSent' }

    const guild = await this.load(guildId)

    const channelId = guild?.panel?.channelId
    const messageId = guild?.panel?.messageId
    if (!channelId || !messageId) return { status: 'notSent' }

    const stored = guild?.panel?.embed
    if (!stored) return { status: 'notConfigured' }

    const options: TicketOption[] = guild?.options ?? []
    const sendable = this.toSendable(stored, options)
    if (!sendable.ok) {
      return { status: 'descriptionTooLong', channelId, messageId }
    }

    const message = await ctx.client.channels
      .fetchMessage(channelId, messageId)
      .catch(() => null)
    if (!message) return { status: 'messageNotFound', channelId, messageId }

    try {
      await message.edit({
        embeds: [sendable.embed],
        allowedMentions: { parse: [] },
      })
    } catch {
      return { status: 'failed', channelId, messageId }
    }

    try {
      await this.syncReactions(
        ctx.client,
        guildId,
        channelId,
        messageId,
        options,
      )
    } catch (error) {
      logger.error('[Ticket] failed to sync panel reactions', error)
    }

    return { status: 'ok', channelId, messageId }
  }

  private async syncReactions(
    client: Client,
    guildId: string,
    channelId: string,
    messageId: string,
    options: readonly TicketOption[],
  ) {
    const keys = this.optionKeys(options)
    const binding = await reactionManager.get(messageId)

    if (keys.length && binding) {
      await reactionManager.edit(client, messageId, (draft) => {
        draft.keys = keys
      })
      return
    }

    if (keys.length) {
      await reactionManager.bind(
        { id: messageId },
        { client, channelId, guildId, keys, permanent: true },
      )
      return
    }

    if (binding) {
      await reactionManager.edit(client, messageId, (draft) => {
        draft.keys = []
      })
    }
  }

  /** Edita o painel que já foi enviado para refletir a embed e as opções salvas. */
  async update(ctx: CommandContext) {
    const { guildId, t } = ctx
    if (!guildId) return

    const botId = ctx.client.user?.id
    if (botId) {
      const missing = await missingPermissions(
        ctx.client.rest,
        guildId,
        botId,
        TICKET_PANEL_PERMISSIONS,
      )
      if (missing.length) {
        await replyMissingBotPermissions(ctx, missing)
        return
      }
    }

    const result = await this.refresh(ctx)

    switch (result.status) {
      case 'notConfigured':
        await this.replyError(
          ctx,
          t('commands.ticket.panel.update.notConfigured.title'),
          t(
            'commands.ticket.panel.update.notConfigured.description',
            ctx.prefix,
          ),
        )
        return

      case 'notSent':
        await this.replyError(
          ctx,
          t('commands.ticket.panel.update.notSent.title'),
          t('commands.ticket.panel.update.notSent.description', ctx.prefix),
        )
        return

      case 'messageNotFound':
        await this.replyError(
          ctx,
          t('commands.ticket.panel.update.messageNotFound.title'),
          t(
            'commands.ticket.panel.update.messageNotFound.description',
            result.channelId,
            ctx.prefix,
          ),
        )
        return

      case 'descriptionTooLong':
        await this.replyTooLong(ctx)
        return

      case 'failed':
        await this.replyError(
          ctx,
          t('commands.ticket.panel.update.failed.title'),
          t(
            'commands.ticket.panel.update.failed.description',
            result.channelId,
          ),
        )
        return

      case 'ok':
        await ctx.reply({
          content: `${config.separator(emojis.success)} ${t(
            'commands.ticket.panel.update.success.description',
            guildId,
            result.channelId,
            result.messageId,
          )}`,
          allowedMentions: { parse: [] },
        })
    }
  }

  async command(ctx: CommandContext) {
    const { args, t } = ctx
    if (!ctx.guildId) return
    if (!(await requireManager(ctx))) return

    if (args.length === 1) return replyUsage(ctx, 'panel')

    const sub = args[1]?.toLowerCase()

    if (['send', 'update', 'preview'].includes(sub ?? '') && args.length > 2) {
      return replyTicketUsageError(
        ctx,
        t(
          'commands.ticket.usage.errors.unexpectedArguments',
          `ticket panel ${sub}`,
        ),
      )
    }
    if (sub === 'send') return this.send(ctx)
    if (sub === 'update') return this.update(ctx)
    if (sub === 'preview') return this.preview(ctx)

    // Only provided args update; the rest of the embed is preserved
    const parsed = parseEmbed(args.slice(1), [...PANEL_EMBED_EXCLUDE], {
      partial: true,
    })

    if (parsed.error) {
      await this.replyEmbedError(ctx, parsed)
      return
    }

    const guild = await this.load(ctx.guildId)
    const result = mergeEmbed(guild?.panel?.embed, parsed.embed)

    if (result.error) {
      await this.replyEmbedError(ctx, result)
      return
    }

    await TicketConfig.updateOne(
      { guildId: ctx.guildId },
      { $set: { 'panel.embed': result.embed } },
      { upsert: true },
    )

    await ctx.reply({
      content: `${config.separator(emojis.success)} ${t('commands.ticket.panel.description', ctx.prefix)}`,
      allowedMentions: { parse: [] },
    })
  }
}

export const ticketPanelManager = new TicketPanelManager()
