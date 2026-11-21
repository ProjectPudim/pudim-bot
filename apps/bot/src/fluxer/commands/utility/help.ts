import { Category } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import {
  buildCategoryEmbed,
  buildCommandEmbed,
  buildHomeEmbed,
  clampPage,
  findCategoryByQuery,
  findCommandByQuery,
  getCategoryPageCount,
  registerHelpReactions,
  sendHelpWithReactions,
  type HelpState,
} from '#bot/managers/help'

registerHelpReactions()

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
    const query = ctx.args[0]?.toLowerCase()

    if (query) {
      const command = findCommandByQuery(ctx, query)
      if (command) {
        await ctx.reply({ embeds: [buildCommandEmbed(ctx, command)] })
        return
      }

      const category = findCategoryByQuery(query, ctx.locale)
      if (category) {
        const requestedPage = Number.parseInt(ctx.args[1] ?? '', 10)
        const state: HelpState = {
          view: 'category',
          category,
          page: clampPage(requestedPage, getCategoryPageCount(ctx, category)),
        }

        await sendHelpWithReactions(
          ctx,
          buildCategoryEmbed(ctx, category, state.page),
          state,
        )
        return
      }
    }

    const state: HelpState = { view: 'home', page: 1 }
    await sendHelpWithReactions(ctx, buildHomeEmbed(ctx), state)
  },
})
