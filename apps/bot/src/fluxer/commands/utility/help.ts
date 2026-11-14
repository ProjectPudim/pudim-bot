import type { CommandContext, CommandInfo } from '@pudim/framework'
import { createCommand } from '#bot/fluxer'
import type { Locale } from '#bot/i18n'
import { reactionManager, type ReactionContext } from '#bot/managers'
import { Category, getCategoryLabel } from '#bot/utils/categories'
import { emojis } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'

const COMMANDS_PER_PAGE = 15
const MAX_DESCRIPTION_LENGTH = 80

const HOME_KEY = 'help-goto-home'
const PREV_KEY = 'help-prev'
const NEXT_KEY = 'help-next'

const CATEGORIES = Object.values(Category)

type HelpState =
  | {
      view: 'home'
      page: 1
    }
  | {
      view: 'category'
      category: Category
      page: number
    }

type HelpReaction = ReactionContext<HelpState>

const gotoKey = (category: Category) => `help-goto-${category}`

function visibleCommands(ctx: CommandContext): CommandInfo[] {
  return ctx.commands.filter((command) => !command.hidden)
}

function describe(command: CommandInfo, locale: Locale): string {
  if (locale === 'pt-BR') {
    return (
      command.descriptionLocalizations?.[locale] ?? command.description ?? ''
    )
  }

  return command.description ?? ''
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }

  return `${text.slice(0, max - 3).trimEnd()}...`
}

function categoryCommands(
  ctx: CommandContext,
  category: Category,
): CommandInfo[] {
  return visibleCommands(ctx)
    .filter((command) => command.category === category)
    .sort((a, b) => a.name.localeCompare(b.name))
}

function pageCount(ctx: CommandContext, category: Category): number {
  return Math.max(
    1,
    Math.ceil(categoryCommands(ctx, category).length / COMMANDS_PER_PAGE),
  )
}

function normalizePage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) {
    return 1
  }

  return Math.min(Math.max(1, Math.trunc(page)), totalPages)
}

function keysFor(ctx: CommandContext, state: HelpState): string[] {
  if (state.view === 'home') {
    return CATEGORIES.map(gotoKey)
  }

  return [
    HOME_KEY,
    ...(pageCount(ctx, state.category) > 1 ? [PREV_KEY, NEXT_KEY] : []),
  ]
}

function parseCommandUsage(usage: string, prefix: string): string {
  return usage
    .split('\n')
    .map((line) => `- \`${line.replaceAll('{prefix}', prefix)}\``)
    .join('\n')
}

function buildHomeEmbed(ctx: CommandContext, categoryLines: string[]) {
  return Embed({
    title: ctx.t('commands.help.home.title'),
    description: ctx.t(
      'commands.help.home.description',
      ctx.prefix,
      categoryLines,
    ),
  })
}

function buildCommandEmbed(ctx: CommandContext, command: CommandInfo) {
  const { t } = ctx
  const locale = ctx.locale as Locale

  const permissions = command.permissions?.length
    ? command.permissions
        .map((permission) => t(`common.permissions.${permission}`))
        .join(', ')
    : `-# ${t('commands.help.command.permissions.none')}`

  return Embed({
    title: `${t('commands.help.home.title')}: ${ctx.prefix}${command.name}`,
    description: describe(command, locale),
    fields: [
      {
        name: `${t('commands.help.command.howToUse')}:`,
        value: parseCommandUsage(
          command.usage ?? '{prefix}' + command.name,
          ctx.prefix,
        ),
        inline: false,
      },
      {
        name: `${t('commands.help.command.aliases.name')}:`,
        value: command.aliases?.length
          ? command.aliases
              .map((alias) => `\`${ctx.prefix}${alias}\``)
              .join(', ')
          : `-# ${t('commands.help.command.aliases.none')}`,
        inline: true,
      },
      {
        name: `${t('commands.help.command.category')}:`,
        value: command.category
          ? `${emojis.category[command.category]} ${getCategoryLabel(command.category, locale)}`
          : '—',
        inline: true,
      },
      {
        name: `${t('commands.help.command.permissions.name')}:`,
        value: permissions,
        inline: true,
      },
    ],
  })
}

function buildCategoryEmbed(ctx: CommandContext, category: Category, page = 1) {
  const { t } = ctx
  const locale = ctx.locale as Locale

  const commands = categoryCommands(ctx, category)
  const totalPages = pageCount(ctx, category)
  const currentPage = normalizePage(page, totalPages)

  const start = (currentPage - 1) * COMMANDS_PER_PAGE

  const lines = commands
    .slice(start, start + COMMANDS_PER_PAGE)
    .map((command) => {
      const description = truncate(
        describe(command, locale),
        MAX_DESCRIPTION_LENGTH,
      )

      return `\`${ctx.prefix}${command.name}\` - ${description}`
    })

  return Embed({
    title: `${emojis.category[category]} ${getCategoryLabel(category, locale)}`,
    description: t('commands.help.category.description', ctx.prefix, lines),
    footer: {
      text: t(
        'commands.help.category.pages',
        totalPages,
        currentPage,
        ctx.prefix,
      ),
    },
  })
}

function generateCategoryLines(
  ctx: CommandContext,
  categories: readonly Category[],
): string[] {
  const { t } = ctx
  const locale = ctx.locale as Locale
  const commands = visibleCommands(ctx)

  return categories.map((category) => {
    const count = commands.filter(
      (command) => command.category === category,
    ).length

    const word = t('commands.help.commandWord', count)

    return (
      `${emojis.category[category]} ` +
      `**${getCategoryLabel(category, locale)}** - ` +
      `${count} ${word} · ` +
      `\`${ctx.prefix}help ${category}\``
    )
  })
}

async function showHome(
  rctx: HelpReaction,
  ctx: CommandContext,
): Promise<void> {
  const state: HelpState = {
    view: 'home',
    page: 1,
  }

  await rctx.edit({
    embeds: [buildHomeEmbed(ctx, generateCategoryLines(ctx, CATEGORIES))],
  })

  rctx.setState(state)
  await rctx.setKeys(keysFor(ctx, state))
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
    page: normalizePage(page, pageCount(ctx, category)),
  }

  await rctx.edit({
    embeds: [buildCategoryEmbed(ctx, category, state.page)],
  })

  rctx.setState(state)
  await rctx.setKeys(keysFor(ctx, state))
}

function withHelp(
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

// Navegação entre categorias
for (const category of CATEGORIES) {
  reactionManager.registry<HelpState>({
    key: gotoKey(category),
    emoji: emojis.category[category],
    process: 'single',
    filter: reactionManager.filters.ownerOnly,
    run: withHelp((rctx, ctx) => showCategory(rctx, ctx, category, 1)),
  })
}

// Voltar ao início
reactionManager.registry<HelpState>({
  key: HOME_KEY,
  emoji: emojis.house,
  process: 'single',
  filter: reactionManager.filters.ownerOnly,
  run: withHelp(showHome),
})

// Página anterior
reactionManager.registry<HelpState>({
  key: PREV_KEY,
  emoji: emojis.arrow_left,
  process: 'single',
  filter: reactionManager.filters.ownerOnly,
  run: withHelp(async (rctx, ctx) => {
    if (rctx.state.view !== 'category') {
      return
    }

    const { category, page } = rctx.state
    const totalPages = pageCount(ctx, category)

    await showCategory(rctx, ctx, category, page <= 1 ? totalPages : page - 1)
  }),
})

// Próxima página
reactionManager.registry<HelpState>({
  key: NEXT_KEY,
  emoji: emojis.arrow_right,
  process: 'single',
  filter: reactionManager.filters.ownerOnly,
  run: withHelp(async (rctx, ctx) => {
    if (rctx.state.view !== 'category') {
      return
    }

    const { category, page } = rctx.state
    const totalPages = pageCount(ctx, category)

    await showCategory(rctx, ctx, category, page >= totalPages ? 1 : page + 1)
  }),
})

async function sendWithButtons(
  ctx: CommandContext,
  embed: ReturnType<typeof Embed>,
  state: HelpState,
): Promise<void> {
  const sent = (await ctx.reply({
    embeds: [embed],
  })) as { id?: string } | undefined

  if (!sent?.id) {
    return
  }

  await reactionManager.bind<HelpState>(sent as { id: string }, {
    client: ctx.client,
    channelId: ctx.channelId,
    guildId: ctx.guildId,
    ownerId: ctx.author.id,
    keys: keysFor(ctx, state),
    state,
    live: ctx,
  })
}

export default createCommand({
  name: 'help',
  description: 'Shows the available commands.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra os comandos disponíveis.',
    'es-ES': 'Muestra los comandos disponibles.',
  },
  category: Category.Utilities,
  usage: '{prefix}help [category | command] [page]',
  aliases: ['ajuda', 'comandos', 'commands'],

  async run(ctx) {
    const { args } = ctx
    const locale = ctx.locale as Locale

    const query = args[0]?.toLowerCase()

    if (query) {
      // Procurar um comando pelo nome ou alias
      const command = visibleCommands(ctx).find(
        (command) =>
          command.name.toLowerCase() === query ||
          command.aliases?.some((alias) => alias.toLowerCase() === query),
      )

      if (command) {
        await ctx.reply({
          embeds: [buildCommandEmbed(ctx, command)],
        })
        return
      }

      // Procurar uma categoria
      const category = CATEGORIES.find(
        (category) =>
          category === query ||
          getCategoryLabel(category, locale).toLowerCase() === query,
      )

      if (category) {
        const requestedPage = Number.parseInt(args[1] ?? '', 10)

        const state: HelpState = {
          view: 'category',
          category,
          page: normalizePage(requestedPage, pageCount(ctx, category)),
        }

        await sendWithButtons(
          ctx,
          buildCategoryEmbed(ctx, category, state.page),
          state,
        )
        return
      }
    }

    // Página inicial
    const state: HelpState = {
      view: 'home',
      page: 1,
    }

    await sendWithButtons(
      ctx,
      buildHomeEmbed(ctx, generateCategoryLines(ctx, CATEGORIES)),
      state,
    )
  },
})
