import { MAX_AUTO_REACTIONS } from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import { Category, colors, emojis } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { reactionManager } from '#bot/managers'
import {
  autoReactionManager,
  type AutoReactionConfig,
} from '#bot/managers/autoreaction'
import { buildTable, Embed, parseChannelId } from '#bot/utils'

const USAGE = '{prefix}autoreaction [add|remove|list|clear] ...'
const PAGE_SIZE = 5

type AutoReactionPageState = {
  page: number
  total: number
  configs: AutoReactionConfig[]
}

function buildPageContent(
  t: (key: string, ...args: unknown[]) => string,
  configs: AutoReactionConfig[],
  total: number,
  page: number,
): string {
  const pages = Math.max(1, Math.ceil(configs.length / PAGE_SIZE))
  const current = Math.min(Math.max(page, 0), pages - 1)
  const slice = configs.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  const translate = t as (key: string, ...args: unknown[]) => string
  const typeLabel = (type: string) =>
    translate(`commands.autoreaction.types.${type}`)
  const formatIgnore = (ignore: string[]) => {
    if (!ignore.length) return translate('commands.autoreaction.none')
    const labels = ignore.map((item) =>
      translate(`commands.autoreaction.ignores.${item}`),
    )
    if (labels.length === 1) return labels[0] ?? ''
    if (labels.length === 2)
      return `${labels[0]} ${translate('commands.autoreaction.and')} ${labels[1]}`
    return `${labels.slice(0, -1).join(', ')}, ${translate('commands.autoreaction.and')} ${labels[labels.length - 1] ?? ''}`
  }

  const rows = slice.map((config) => {
    const channel = `<#${config.channelId}>`
    return [
      channel,
      config.reaction,
      typeLabel(config.type),
      formatIgnore(config.ignore),
    ]
  })

  const headers = [
    translate('commands.autoreaction.tableHeaders.channel'),
    translate('commands.autoreaction.tableHeaders.reaction'),
    translate('commands.autoreaction.tableHeaders.type'),
    translate('commands.autoreaction.tableHeaders.ignore'),
  ]

  return [
    translate('commands.autoreaction.limitLine', total, MAX_AUTO_REACTIONS),
    '',
    buildTable({ headers, rows }),
  ].join('\n')
}

export default createCommand({
  name: 'autoreaction',
  description: 'Configures automatic reactions.',
  descriptionLocalizations: {
    'pt-BR': 'Configura reações automáticas.',
    'es-ES': 'Configura reacciones automáticas.',
  },
  category: Category.Settings,
  usage: USAGE,
  aliases: ['ar', 'autoreact'],
  context: 'guild',
  userPermissions: 'ManageGuild',
  async run(ctx) {
    const { t, args, author, client, guildId } = ctx
    if (!guildId) return

    const sub = args[0]?.toLowerCase()
    if (!sub) {
      await ctx.reply({
        embeds: [
          Embed({
            title: t('commands.autoreaction.title'),
            description: t('commands.autoreaction.help.description'),
            fields: [
              {
                name: t('commands.autoreaction.help.commands'),
                value: [
                  '- `autoreaction add <channel|id> <reaction> <type> [ignore]`',
                  '- `autoreaction remove <channel|id> <reaction>`',
                  '- `autoreaction list [channel|id]`',
                  '- `autoreaction clear <channel|id>`',
                ].join('\n'),
              },
              {
                name: t('commands.autoreaction.help.types'),
                value: '`all`, `text`, `image`, `video`, `media`, `link`',
                inline: true,
              },
              {
                name: t('commands.autoreaction.help.ignores'),
                value: '`bots`, `replies`, `webhooks`',
                inline: true,
              },
              {
                name: t('commands.autoreaction.help.limitLabel'),
                value: t(
                  'commands.autoreaction.help.limit',
                  MAX_AUTO_REACTIONS,
                ),
              },
            ],
            color: colors.primary,
          }),
        ],
        allowedMentions: {
          parse: [],
          users: [author.id],
          roles: [],
          repliedUser: true,
        },
      })
      return
    }

    if (sub === 'add') {
      const channelId = parseChannelId(args[1])
      const reactionRaw = args[2]
      const typeRaw = args[3]
      const ignoreRaw = args.slice(4).join(' ')

      if (!channelId || !reactionRaw || !typeRaw) {
        await ctx.reply({
          content: t('common.invalidCommandUsage', USAGE, ctx.prefix),
        })
        return
      }

      const channel = await client.channels.fetch(channelId).catch(() => null)
      if (!channel || !channel.isGuild() || channel.guildId !== guildId) {
        await ctx.reply({
          content: t('commands.autoreaction.invalidChannel'),
        })
        return
      }

      const reaction = autoReactionManager.normalizeReaction(reactionRaw)
      if (!reaction) {
        await ctx.reply({
          content: t('commands.autoreaction.invalidEmoji'),
        })
        return
      }

      const type = autoReactionManager.validateType(typeRaw)
      if (!type) {
        await ctx.reply({
          content: t('commands.autoreaction.invalidType'),
        })
        return
      }

      const ignore = autoReactionManager.normalizeIgnore(ignoreRaw || undefined)
      if (ignore === null) {
        await ctx.reply({
          content: t('commands.autoreaction.invalidIgnore'),
        })
        return
      }

      const result = await autoReactionManager.add(
        guildId,
        channelId,
        reaction,
        type,
        ignore,
      )
      if (!result.ok) {
        const description =
          result.reason === 'duplicate'
            ? t('commands.autoreaction.duplicate')
            : result.reason === 'limit'
              ? t('commands.autoreaction.limitReached', MAX_AUTO_REACTIONS)
              : t('errors.actionFailed')
        await ctx.reply({
          content: description,
        })
        return
      }

      const ignoreLabels = ignore.map((item) =>
        (t as (key: string, ...args: unknown[]) => string)(
          `commands.autoreaction.ignores.${item}`,
        ),
      )
      let ignoreSentence = ''
      if (ignoreLabels.length) {
        const list = (
          ignoreLabels.length === 1
            ? (ignoreLabels[0] ?? '')
            : `${ignoreLabels.slice(0, -1).join(', ')}, ${t('commands.autoreaction.and')} ${ignoreLabels[ignoreLabels.length - 1] ?? ''}`
        ) as string
        ignoreSentence = t('commands.autoreaction.added.ignore', list)
      }
      const content = `${t(`commands.autoreaction.added.${type}`, reaction, `<#${channelId}>`)}${ignoreSentence ? ` ${ignoreSentence}` : ''}`
      await ctx.reply({
        content,
        allowedMentions: {
          parse: [],
          users: [author.id],
          roles: [],
          repliedUser: true,
        },
      })
      return
    }

    if (sub === 'remove') {
      const channelId = parseChannelId(args[1])
      const reactionRaw = args[2]
      if (!channelId || !reactionRaw) {
        await ctx.reply({
          content: t('common.invalidCommandUsage', USAGE, ctx.prefix),
        })
        return
      }

      const reaction = autoReactionManager.normalizeReaction(reactionRaw)
      if (!reaction) {
        await ctx.reply({
          content: t('commands.autoreaction.invalidEmoji'),
        })
        return
      }

      const removed = await autoReactionManager.remove(
        guildId,
        channelId,
        reaction,
      )
      if (removed === 0) {
        await ctx.reply({
          content: t('commands.autoreaction.notFound'),
        })
        return
      }

      await ctx.reply({
        content: t(
          'commands.autoreaction.removed.message',
          reaction,
          `<#${channelId}>`,
        ),
        allowedMentions: {
          parse: [],
          users: [author.id],
          roles: [],
          repliedUser: true,
        },
      })
      return
    }

    if (sub === 'clear') {
      const channelId = parseChannelId(args[1])
      if (!channelId) {
        await ctx.reply({
          content: t('common.invalidCommandUsage', USAGE, ctx.prefix),
        })
        return
      }

      const removed = await autoReactionManager.clear(guildId, channelId)
      await ctx.reply({
        content: t('commands.autoreaction.cleared.message', removed),
        allowedMentions: {
          parse: [],
          users: [author.id],
          roles: [],
          repliedUser: true,
        },
      })
      return
    }

    if (sub === 'list') {
      const channelId = args[1] ? parseChannelId(args[1]) : null
      if (args[1] && !channelId) {
        await ctx.reply({
          content: t('commands.autoreaction.invalidChannel'),
        })
        return
      }

      const configs = await autoReactionManager.list(
        guildId,
        channelId ?? undefined,
      )
      if (!configs.length) {
        await ctx.reply({
          content: t('commands.autoreaction.listEmpty'),
          allowedMentions: {
            parse: [],
            users: [author.id],
            roles: [],
            repliedUser: true,
          },
        })
        return
      }

      const total = (await autoReactionManager.list(guildId)).length

      const sortedConfigs = [...configs].sort((a, b) =>
        `${a.channelId}:${a.reaction}:${a.type}`.localeCompare(
          `${b.channelId}:${b.reaction}:${b.type}`,
        ),
      )

      const translate = t as (key: string, ...args: unknown[]) => string
      const description = buildPageContent(translate, sortedConfigs, total, 0)

      const pages = Math.max(1, Math.ceil(sortedConfigs.length / PAGE_SIZE))

      const sent = (await ctx.reply({
        content: `${t('commands.autoreaction.listTitle')}\n\n${description}\n\n${t('commands.autoreaction.pageIndicator', 1, pages)}`,
        allowedMentions: {
          parse: [],
          users: [author.id],
          roles: [],
          repliedUser: true,
        },
      })) as { id?: string } | undefined

      if (sent?.id && pages > 1) {
        await reactionManager.bind<AutoReactionPageState>(
          sent as { id: string },
          {
            client: ctx.client,
            channelId: ctx.channelId,
            guildId: ctx.guildId,
            ownerId: ctx.author.id,
            keys: ['autoreaction-prev', 'autoreaction-next'],
            state: {
              page: 0,
              total,
              configs: sortedConfigs,
            },
            live: ctx,
          },
        )
      }
      return
    }

    await ctx.reply({
      content: t('common.invalidCommandUsage', USAGE, ctx.prefix),
    })
  },
})

reactionManager.registry<AutoReactionPageState>({
  key: 'autoreaction-prev',
  emoji: emojis.arrow_left,
  process: 'single',
  filter: reactionManager.filters.ownerOnly,
  run: async (rctx) => {
    const ctx = rctx.live as CommandContext | undefined
    if (!ctx) {
      await rctx.unbind({ clearReactions: true })
      return
    }
    const state = rctx.state
    const next = Math.max(state.page - 1, 0)
    if (next === state.page) return
    state.page = next
    rctx.setState({ page: next })
    const editPages = Math.max(1, Math.ceil(state.configs.length / PAGE_SIZE))
    const translate = ctx.t as (key: string, ...args: unknown[]) => string
    await rctx.edit({
      content: `${translate('commands.autoreaction.listTitle')}\n\n${buildPageContent(
        translate,
        state.configs,
        state.total,
        next,
      )}\n\n${translate('commands.autoreaction.pageIndicator', next + 1, editPages)}`,
      allowedMentions: { parse: [] },
    })
  },
})

reactionManager.registry<AutoReactionPageState>({
  key: 'autoreaction-next',
  emoji: emojis.arrow_right,
  process: 'single',
  filter: reactionManager.filters.ownerOnly,
  run: async (rctx) => {
    const ctx = rctx.live as CommandContext | undefined
    if (!ctx) {
      await rctx.unbind({ clearReactions: true })
      return
    }
    const state = rctx.state
    const pages = Math.max(1, Math.ceil(state.configs.length / PAGE_SIZE))
    const next = Math.min(state.page + 1, pages - 1)
    if (next === state.page) return
    state.page = next
    rctx.setState({ page: next })
    const editPages = Math.max(1, Math.ceil(state.configs.length / PAGE_SIZE))
    const translate = ctx.t as (key: string, ...args: unknown[]) => string
    await rctx.edit({
      content: `${translate('commands.autoreaction.listTitle')}\n\n${buildPageContent(
        translate,
        state.configs,
        state.total,
        next,
      )}\n\n${translate('commands.autoreaction.pageIndicator', next + 1, editPages)}`,
      allowedMentions: { parse: [] },
    })
  },
})
