import { MAX_GIVEAWAY_WINNERS } from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import { Category, config, emojis } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { giveawayManager } from '#bot/managers/giveaway'
import {
  giveawayOperation,
  logGiveawayFailure,
} from '#bot/managers/giveaway/diagnostics'
import {
  GiveawayError,
  isSnowflake,
  messageLink,
  parseMessageUrl,
} from '#bot/managers/giveaway/helpers'
import { parseCreate } from '#bot/managers/giveaway/parse'
import {
  GIVEAWAY_COMMANDS,
  GIVEAWAY_USAGE,
  giveawayHelp,
  type GiveawayCommand,
} from '#bot/managers/giveaway/usage'

async function errorReply(ctx: CommandContext, description: string) {
  await ctx.reply({
    content: `${config.separator(emojis.error)} ${description}`,
    allowedMentions: { parse: [] },
  })
}

async function manage(ctx: CommandContext, action: () => Promise<void>) {
  await action()
}

export default createCommand({
  name: 'giveaway',
  description: 'Manages giveaways.',
  descriptionLocalizations: {
    'pt-BR': 'Gerencia sorteios.',
    'es-ES': 'Gestiona sorteos.',
  },
  category: Category.Utilities,
  usage: GIVEAWAY_USAGE,
  aliases: ['gw', 'sorteio'],
  userPermissions: 'ManageGuild',
  context: 'guild',
  async run(ctx) {
    if (!ctx.guildId) return
    const { t, client, guildId } = ctx
    const sub = ctx.args[0]?.toLowerCase()
    const help = async (name?: GiveawayCommand) => {
      await ctx.reply({
        embeds: [giveawayHelp(ctx, name)],
        allowedMentions: {
          parse: [],
          users: [ctx.author.id],
          roles: [],
          repliedUser: true,
        },
      })
    }
    if (ctx.args.length === 0 || (sub === '--help' && ctx.args.length === 1)) {
      await help()
      return
    }
    if (!sub || !Object.hasOwn(GIVEAWAY_COMMANDS, sub)) {
      await help()
      return
    }
    const command = sub as GiveawayCommand
    const args = ctx.args.slice(1)
    if (args.length === 1 && args[0] === '--help') {
      await help(command)
      return
    }
    if (command !== 'create' && !args.length) {
      await help(command)
      return
    }
    try {
      if (command === 'create') {
        const parsed = parseCreate(args, t)
        if (parsed.error !== undefined) {
          await errorReply(ctx, parsed.error)
          return
        }
        if ('missing' in parsed) {
          await help('create')
          return
        }
        await manage(ctx, async () => {
          const giveaway = await giveawayManager.create(client, parsed.data, {
            guildId,
            channelId: ctx.channelId,
            creatorId: ctx.author.id,
            locale: ctx.locale,
          })
          await giveawayOperation(
            {
              operationId: String(giveaway._id),
              operation: 'command.create.reply',
            },
            () =>
              ctx.reply({
                content: `${config.separator(emojis.success)} ${t(
                  'commands.giveaway.created',
                  messageLink(guildId, giveaway.channelId, giveaway.messageId),
                )}`,
                allowedMentions: { parse: [] },
              }),
          )
        })
        return
      }
      const input = args[0]!
      let messageId = input
      const parsedUrl = parseMessageUrl(input)
      if (parsedUrl) {
        if (parsedUrl.guildId !== guildId) {
          await errorReply(ctx, t('commands.giveaway.errors.notFound'))
          return
        }
        messageId = parsedUrl.messageId
      } else if (!isSnowflake(input)) {
        await errorReply(ctx, t('commands.giveaway.errors.invalidLink'))
        return
      }
      if (args.length > 1) throw new GiveawayError('extra')
      await manage(ctx, async () => {
        const result = await giveawayManager[command](
          client,
          guildId,
          messageId,
        )
        if (command === 'reroll') {
          await ctx.reply({
            content: `${config.separator(emojis.success)} ${t('commands.giveaway.rerolled', String(result._id))}`,
            allowedMentions: { parse: [] },
          })
        } else {
          await ctx.reply({
            content: `${config.separator(emojis.success)} ${t(
              result.status === 'cancelled'
                ? 'commands.giveaway.cancelled'
                : 'commands.giveaway.completed',
            )}`,
            allowedMentions: { parse: [] },
          })
        }
      })
    } catch (error) {
      if (!(error instanceof GiveawayError)) {
        logGiveawayFailure(error, {
          operationId: ctx.message?.id ?? ctx.invokedName,
          operation: `command.${command}`,
        })
        await errorReply(ctx, t('commands.giveaway.failed'))
        return
      }
      await errorReply(
        ctx,
        error.code === 'winners'
          ? t('commands.giveaway.errors.winners', MAX_GIVEAWAY_WINNERS)
          : t(`commands.giveaway.errors.${error.code}`),
      )
    }
  },
})
