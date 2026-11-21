import { TicketConfig, type TicketOption } from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import { colors, config, emojis } from '#bot/config'
import { Embed } from '#bot/utils'
import { parseEmoji } from '#bot/utils/emojis'
import { requireManager } from './helpers'
import { ticketPanelManager } from './panel'
import { replyTicketUsageError, replyUsage } from './usage'

const MAX_OPTIONS = 10
const NAME_MAX = 40

export class TicketOptionManager {
  private async replyError(ctx: CommandContext, description: string) {
    await ctx.reply({
      content: `${config.separator(emojis.error)} ${description}`,
      allowedMentions: { parse: [] },
    })
  }

  private async loadOptions(guildId: string): Promise<TicketOption[]> {
    const config = await TicketConfig.findOne({ guildId }).lean()
    return config?.options ?? []
  }

  /** Diz se o painel enviado já foi atualizado, ou o que fazer se não foi. */
  private async panelNote(ctx: CommandContext) {
    const { t } = ctx
    const result = await ticketPanelManager.refresh(ctx)

    switch (result.status) {
      case 'ok':
        return t('commands.ticket.option.panelSync.ok')
      case 'descriptionTooLong':
        return t('commands.ticket.option.panelSync.tooLong')
      case 'messageNotFound':
      case 'failed':
        return t('commands.ticket.option.panelSync.failed', ctx.prefix)
      default:
        return t('commands.ticket.option.panelSync.notSent', ctx.prefix)
    }
  }

  async add(ctx: CommandContext) {
    const { args, guildId, t } = ctx
    if (!guildId) return

    const reaction = args[2]
    const name = args.slice(3).join(' ').trim()

    if (args.length === 2) return replyUsage(ctx, 'option.add')
    if (!reaction)
      return this.replyError(ctx, t('commands.ticket.option.invalidEmoji'))
    if (!name)
      return this.replyError(
        ctx,
        t('commands.ticket.usage.errors.missingOptionName'),
      )

    const emoji = parseEmoji(reaction)
    if (!emoji) {
      await this.replyError(ctx, t('commands.ticket.option.invalidEmoji'))
      return
    }

    if ([...name].length > NAME_MAX) {
      await this.replyError(
        ctx,
        t('commands.ticket.option.nameTooLong', NAME_MAX),
      )
      return
    }

    const options = await this.loadOptions(guildId)

    if (options.some((o) => o.id === emoji.id)) {
      await this.replyError(
        ctx,
        t('commands.ticket.option.alreadyExists', emoji.display),
      )
      return
    }
    if (options.length >= MAX_OPTIONS) {
      await this.replyError(
        ctx,
        t('commands.ticket.option.limitReached', MAX_OPTIONS),
      )
      return
    }

    await TicketConfig.updateOne(
      { guildId },
      {
        $push: {
          options: { id: emoji.id, emoji: emoji.display, name },
        },
      },
      { upsert: true },
    )

    const note = await this.panelNote(ctx)

    await ctx.reply({
      content: `${config.separator(emojis.success)} ${[
        t('commands.ticket.option.add.description', emoji.display, name),
        note,
      ].join('\n')}`,
      allowedMentions: { parse: [] },
    })
  }

  async remove(ctx: CommandContext) {
    const { args, guildId, t } = ctx
    if (!guildId) return

    const reaction = args[2]
    if (args.length === 2) return replyUsage(ctx, 'option.remove')

    const emoji = parseEmoji(reaction)
    if (!emoji) {
      await this.replyError(ctx, t('commands.ticket.option.invalidEmoji'))
      return
    }

    const options = await this.loadOptions(guildId)
    const option = options.find((o) => o.id === emoji.id)
    if (!option) {
      await this.replyError(
        ctx,
        t('commands.ticket.option.notFound', emoji.display),
      )
      return
    }

    await TicketConfig.updateOne(
      { guildId },
      { $pull: { options: { id: option.id } } },
    )

    const note = await this.panelNote(ctx)

    await ctx.reply({
      content: `${config.separator(emojis.success)} ${[
        t(
          'commands.ticket.option.remove.description',
          option.emoji,
          option.name,
        ),
        note,
      ].join('\n')}`,
      allowedMentions: { parse: [] },
    })
  }

  async list(ctx: CommandContext) {
    const { guildId, t } = ctx
    if (!guildId) return

    const options = await this.loadOptions(guildId)

    await ctx.reply({
      embeds: [
        Embed({
          title: t('commands.ticket.option.list.title'),
          description: options.length
            ? [
                t('commands.ticket.option.list.count', options.length),
                '',
                ...options.map((option) =>
                  t(
                    'commands.ticket.option.list.line',
                    option.emoji,
                    option.name,
                  ),
                ),
              ].join('\n')
            : t('commands.ticket.option.list.empty'),
          color: colors.primary,
        }),
      ],
      allowedMentions: { parse: [] },
    })
  }

  async command(ctx: CommandContext) {
    if (!ctx.guildId) return
    if (!(await requireManager(ctx))) return

    const sub = ctx.args[1]?.toLowerCase()
    if (!sub && ctx.args.length === 1) return replyUsage(ctx, 'option')

    if (sub === 'add') return this.add(ctx)
    if (sub === 'remove') return this.remove(ctx)
    if (sub === 'list') {
      if (ctx.args.length > 2)
        return replyTicketUsageError(
          ctx,
          ctx.t(
            'commands.ticket.usage.errors.unexpectedArguments',
            'ticket option list',
          ),
        )
      return this.list(ctx)
    }
    await replyTicketUsageError(
      ctx,
      ctx.t('commands.ticket.usage.errors.invalidOptionAction'),
    )
  }
}

export const ticketOptionManager = new TicketOptionManager()
