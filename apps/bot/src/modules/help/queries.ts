import type { CommandContext, CommandInfo } from '@pudim/framework'
import { Category, getCategoryLabel } from '#bot/config'
import type { Locale } from '#bot/i18n'

export const COMMANDS_PER_PAGE = 15
export const MAX_DESCRIPTION_LENGTH = 80
export const HELP_CATEGORIES = Object.values(Category)

export type HelpState =
  | {
      view: 'home'
      page: 1
    }
  | {
      view: 'category'
      category: Category
      page: number
    }

export function getVisibleCommands(ctx: CommandContext): CommandInfo[] {
  return ctx.commands.filter((command) => !command.hidden)
}

export function describeCommand(command: CommandInfo, locale: Locale): string {
  if (locale === 'pt-BR') {
    return (
      command.descriptionLocalizations?.[locale] ?? command.description ?? ''
    )
  }
  return command.description ?? ''
}

export function getCategoryCommands(
  ctx: CommandContext,
  category: Category,
): CommandInfo[] {
  return getVisibleCommands(ctx)
    .filter((command) => command.category === category)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getCategoryPageCount(
  ctx: CommandContext,
  category: Category,
): number {
  return Math.max(
    1,
    Math.ceil(getCategoryCommands(ctx, category).length / COMMANDS_PER_PAGE),
  )
}

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1
  return Math.min(Math.max(1, Math.trunc(page)), totalPages)
}

export function findCommandByQuery(
  ctx: CommandContext,
  query: string,
): CommandInfo | undefined {
  return getVisibleCommands(ctx).find(
    (command) =>
      command.name.toLowerCase() === query ||
      command.aliases?.some((alias) => alias.toLowerCase() === query),
  )
}

export function findCategoryByQuery(
  query: string,
  locale: Locale,
): Category | undefined {
  return HELP_CATEGORIES.find(
    (category) =>
      category === query ||
      getCategoryLabel(category, locale).toLowerCase() === query,
  )
}
