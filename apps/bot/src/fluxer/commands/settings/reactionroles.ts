import { Reaction } from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import { Category, colors, emojis } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { reactionManager } from '#bot/managers/reaction'
import { reactionRoleManager } from '#bot/managers/reactionroles'
import { buildTable, Embed } from '#bot/utils'

const USAGE = '{prefix}reactionroles [add|remove|list] ...'
const PAGE_SIZE = 5

type ReactionRoleListItem = {
  messageId: string
  channelId: string
  url: string
  emoji: string
  roleId: string
}

type ReactionRolePageState = {
  page: number
  total: number
  items: ReactionRoleListItem[]
}

function buildPageContent(
  t: (key: string, ...args: unknown[]) => string,
  items: ReactionRoleListItem[],
  page: number,
): string {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const current = Math.min(Math.max(page, 0), pages - 1)
  const slice = items.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  const translate = t as (key: string, ...args: unknown[]) => string
  const rows = slice.map((item) => [item.url, item.emoji, `<@&${item.roleId}>`])

  const headers = [
    translate('commands.reactionroles.tableHeaders.message'),
    translate('commands.reactionroles.tableHeaders.reaction'),
    translate('commands.reactionroles.tableHeaders.role'),
  ]

  return [
    translate('commands.reactionroles.limitLine', items.length),
    '',
    buildTable({ headers, rows }),
    '',
    translate('commands.reactionroles.pageIndicator', current + 1, pages),
  ].join('\n')
}

async function handleList(ctx: CommandContext) {
  const { t, author, guildId } = ctx
  if (!guildId) return

  const docs = await Reaction.find({ guildId })
    .lean()
    .catch(() => [])
  const items: ReactionRoleListItem[] = []
  for (const doc of docs) {
    const roles = (doc.state as { roles?: Record<string, string> } | undefined)
      ?.roles
    if (!roles) continue
    for (const [key, roleId] of Object.entries(roles)) {
      items.push({
        messageId: doc.messageId,
        channelId: doc.channelId,
        url: `https://web.fluxer.app/channels/${guildId}/${doc.channelId}/${doc.messageId}`,
        emoji: key.slice(3),
        roleId,
      })
    }
  }

  if (!items.length) {
    await ctx.reply({
      content: t('commands.reactionroles.listEmpty'),
    })
    return
  }

  items.sort((a, b) => a.messageId.localeCompare(b.messageId))

  const translate = t as (key: string, ...args: unknown[]) => string
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const description = buildPageContent(translate, items, 0)

  const sent = (await ctx.reply({
    content: `${t('commands.reactionroles.listTitle')}\n\n${description}`,
    allowedMentions: {
      parse: [],
      users: [author.id],
      roles: [],
      repliedUser: true,
    },
  })) as { id?: string } | undefined

  if (sent?.id && pages > 1) {
    await reactionManager.bind<ReactionRolePageState>(sent as { id: string }, {
      client: ctx.client,
      channelId: ctx.channelId,
      guildId: ctx.guildId,
      ownerId: ctx.author.id,
      keys: ['reactionroles-prev', 'reactionroles-next'],
      state: {
        page: 0,
        total: items.length,
        items,
      },
      live: ctx,
    })
  }
}

export default createCommand({
  name: 'reactionroles',
  description: 'Gives roles when members react.',
  descriptionLocalizations: {
    'pt-BR': 'Dá cargos quando membros reagem.',
    'es-ES': 'Da roles cuando los miembros reaccionan.',
  },
  category: Category.Settings,
  aliases: ['rr', 'reactionrole'],
  usage: USAGE,
  context: 'guild',
  userPermissions: 'ManageRoles',
  async run(ctx) {
    if (ctx.args.length === 0) {
      await ctx.reply({
        embeds: [
          Embed({
            title: ctx.t('commands.reactionroles.usage.title'),
            description: ctx.t('commands.reactionroles.usage.description'),
            fields: [
              {
                name: ctx.t('commands.reactionroles.usage.commands'),
                value: [
                  '- `reactionroles add <messageUrl> <reaction> <role>`',
                  '- `reactionroles remove <messageUrl> <reaction>`',
                  '- `reactionroles list`',
                ].join('\n'),
              },
              {
                name: ctx.t('commands.reactionroles.usage.arguments'),
                value: ctx.t(
                  'commands.reactionroles.usage.argumentsDescription',
                ),
                inline: true,
              },
              {
                name: ctx.t('commands.reactionroles.usage.requirements'),
                value: ctx.t(
                  'commands.reactionroles.usage.requirementsDescription',
                ),
                inline: true,
              },
            ],
            color: colors.primary,
          }),
        ],
        allowedMentions: {
          parse: [],
          users: [ctx.author.id],
          roles: [],
          repliedUser: true,
        },
      })
      return
    }

    if (ctx.args[0]?.toLowerCase() === 'list') {
      await handleList(ctx)
      return
    }
    await reactionRoleManager.command(ctx, USAGE)
  },
})

reactionManager.registry<ReactionRolePageState>({
  key: 'reactionroles-prev',
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
    const translate = ctx.t as (key: string, ...args: unknown[]) => string
    await rctx.edit({
      content: `${translate('commands.reactionroles.listTitle')}\n\n${buildPageContent(
        translate,
        state.items,
        next,
      )}`,
      allowedMentions: { parse: [] },
    })
  },
})

reactionManager.registry<ReactionRolePageState>({
  key: 'reactionroles-next',
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
    const pages = Math.max(1, Math.ceil(state.items.length / PAGE_SIZE))
    const next = Math.min(state.page + 1, pages - 1)
    if (next === state.page) return
    state.page = next
    rctx.setState({ page: next })
    const translate = ctx.t as (key: string, ...args: unknown[]) => string
    await rctx.edit({
      content: `${translate('commands.reactionroles.listTitle')}\n\n${buildPageContent(
        translate,
        state.items,
        next,
      )}`,
      allowedMentions: { parse: [] },
    })
  },
})
