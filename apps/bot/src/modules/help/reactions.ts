import type { CommandContext } from '@pudim/framework'
import { emojis, type Category } from '#bot/config'
import { reactionManager, type ReactionContext } from '#bot/managers'
import type { Embed } from '#bot/utils'
import { buildCategoryEmbed, buildHomeEmbed } from './embeds'
import {
  clampPage,
  getCategoryPageCount,
  HELP_CATEGORIES,
  type HelpState,
} from './queries'

const HOME_KEY = 'help-goto-home'
const PREV_KEY = 'help-prev'
const NEXT_KEY = 'help-next'
const gotoCategoryKey = (category: Category) => `help-goto-${category}`

type HelpReaction = ReactionContext<HelpState>

let registered = false

function keysForState(ctx: CommandContext, state: HelpState): string[] {
  if (state.view === 'home') {
    return HELP_CATEGORIES.map(gotoCategoryKey)
  }

  return [
    HOME_KEY,
    ...(getCategoryPageCount(ctx, state.category) > 1
      ? [PREV_KEY, NEXT_KEY]
      : []),
  ]
}

async function showHome(
  rctx: HelpReaction,
  ctx: CommandContext,
): Promise<void> {
  const state: HelpState = { view: 'home', page: 1 }
  await rctx.edit({ embeds: [buildHomeEmbed(ctx)] })
  rctx.setState(state)
  await rctx.setKeys(keysForState(ctx, state))
}

async function showCategory(
  rctx: HelpReaction,
  ctx: CommandContext,
  category: Category,
  page: number,
): Promise<void> {
  const state: HelpState = {
    view: 'category',
    category,
    page: clampPage(page, getCategoryPageCount(ctx, category)),
  }
  await rctx.edit({ embeds: [buildCategoryEmbed(ctx, category, state.page)] })
  rctx.setState(state)
  await rctx.setKeys(keysForState(ctx, state))
}

function withLiveHelpContext(
  callback: (rctx: HelpReaction, ctx: CommandContext) => Promise<void>,
) {
  return async (rctx: HelpReaction): Promise<void> => {
    const ctx = rctx.live as CommandContext | undefined
    if (!ctx) {
      await rctx.unbind()
      return
    }
    await callback(rctx, ctx)
  }
}

export function registerHelpReactions(): void {
  if (registered) return
  registered = true

  for (const category of HELP_CATEGORIES) {
    reactionManager.registry<HelpState>({
      key: gotoCategoryKey(category),
      emoji: emojis.category[category],
      process: 'single',
      filter: reactionManager.filters.ownerOnly,
      run: withLiveHelpContext((rctx, ctx) =>
        showCategory(rctx, ctx, category, 1),
      ),
    })
  }

  reactionManager.registry<HelpState>({
    key: HOME_KEY,
    emoji: emojis.house,
    process: 'single',
    filter: reactionManager.filters.ownerOnly,
    run: withLiveHelpContext(showHome),
  })

  reactionManager.registry<HelpState>({
    key: PREV_KEY,
    emoji: emojis.arrow_left,
    process: 'single',
    filter: reactionManager.filters.ownerOnly,
    run: withLiveHelpContext(async (rctx, ctx) => {
      if (rctx.state.view !== 'category') return
      const { category, page } = rctx.state
      const totalPages = getCategoryPageCount(ctx, category)
      await showCategory(rctx, ctx, category, page <= 1 ? totalPages : page - 1)
    }),
  })

  reactionManager.registry<HelpState>({
    key: NEXT_KEY,
    emoji: emojis.arrow_right,
    process: 'single',
    filter: reactionManager.filters.ownerOnly,
    run: withLiveHelpContext(async (rctx, ctx) => {
      if (rctx.state.view !== 'category') return
      const { category, page } = rctx.state
      const totalPages = getCategoryPageCount(ctx, category)
      await showCategory(rctx, ctx, category, page >= totalPages ? 1 : page + 1)
    }),
  })
}

export async function sendHelpWithReactions(
  ctx: CommandContext,
  embed: ReturnType<typeof Embed>,
  state: HelpState,
): Promise<void> {
  const sent = (await ctx.reply({ embeds: [embed] })) as
    { id?: string } | undefined
  if (!sent?.id) return

  await reactionManager.bind<HelpState>(sent as { id: string }, {
    client: ctx.client,
    channelId: ctx.channelId,
    guildId: ctx.guildId,
    ownerId: ctx.author.id,
    keys: keysForState(ctx, state),
    state,
    live: ctx,
  })
}
