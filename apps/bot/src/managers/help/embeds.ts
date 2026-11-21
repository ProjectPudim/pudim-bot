import { PermissionsBitField, type PermissionString } from '@fluxerjs/core'
import type { CommandContext, CommandInfo } from '@pudim/framework'
import { emojis, getCategoryLabel, type Category } from '#bot/config'
import { Embed, truncate } from '#bot/utils'
import {
  clampPage,
  COMMANDS_PER_PAGE,
  describeCommand,
  getCategoryCommands,
  getCategoryPageCount,
  getVisibleCommands,
  HELP_CATEGORIES,
  MAX_DESCRIPTION_LENGTH,
} from './queries'

function formatCommandUsage(usage: string, prefix: string): string {
  return usage
    .split('\n')
    .map((line) => `- \`${line.replaceAll('{prefix}', prefix)}\``)
    .join('\n')
}

function extractPermissionNames(command: CommandInfo): PermissionString[] {
  if (command.permissions?.length) return command.permissions
  if (command.userPermissions !== undefined) {
    return new PermissionsBitField(command.userPermissions).toArray()
  }
  return []
}

export function generateCategoryLines(ctx: CommandContext): string[] {
  const { t, locale } = ctx
  const commands = getVisibleCommands(ctx)

  return HELP_CATEGORIES.map((category) => {
    const count = commands.filter((cmd) => cmd.category === category).length
    const word = t('commands.help.commandWord', count)

    return (
      `${emojis.category[category]} ` +
      `**${getCategoryLabel(category, locale)}** - ` +
      `${count} ${word} · ` +
      `\`${ctx.prefix}help ${category}\``
    )
  })
}

export function buildHomeEmbed(ctx: CommandContext) {
  return Embed({
    title: ctx.t('commands.help.home.title'),
    description: ctx.t(
      'commands.help.home.description',
      ctx.prefix,
      generateCategoryLines(ctx),
    ),
  })
}

export function buildCommandEmbed(ctx: CommandContext, command: CommandInfo) {
  const { t, locale } = ctx
  const permissionList = extractPermissionNames(command)

  const permissions = permissionList.length
    ? permissionList
        .map((permission) => t(`common.permissions.${permission}`))
        .join(', ')
    : `-# ${t('commands.help.command.permissions.none')}`

  return Embed({
    title: `${t('commands.help.home.title')}: ${ctx.prefix}${command.name}`,
    description: describeCommand(command, locale),
    fields: [
      {
        name: `${t('commands.help.command.howToUse')}:`,
        value: formatCommandUsage(
          command.usage ?? `{prefix}${command.name}`,
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

export function buildCategoryEmbed(
  ctx: CommandContext,
  category: Category,
  page = 1,
) {
  const { t, locale } = ctx
  const commands = getCategoryCommands(ctx, category)
  const totalPages = getCategoryPageCount(ctx, category)
  const currentPage = clampPage(page, totalPages)
  const start = (currentPage - 1) * COMMANDS_PER_PAGE

  const lines = commands
    .slice(start, start + COMMANDS_PER_PAGE)
    .map((command) => {
      const description = truncate(
        describeCommand(command, locale),
        MAX_DESCRIPTION_LENGTH,
        '...',
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
