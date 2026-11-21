import { randomInt } from 'node:crypto'
import type { CommandContext, LocalizationMap } from '@pudim/framework'
import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { i18n } from '#bot/i18n'
import { Embed, parseUserId } from '#bot/utils'
import {
  fetchRoleplayMedia,
  type RoleplayAction,
} from '#bot/utils/roleplay-api'

export interface RoleplayCommandConfig {
  action: RoleplayAction
  description: string
  descriptionLocalizations: LocalizationMap
  aliases: readonly string[]
}

export async function runRoleplayAction(
  ctx: CommandContext,
  action: RoleplayAction,
): Promise<void> {
  const { args, author, t } = ctx
  const targetId = parseUserId(args[0])

  if (!targetId) {
    await ctx.reply({
      content: t('commands.roleplay.messages.invalidUsage'),
    })
    return
  }

  const media = await fetchRoleplayMedia(action)
  const dictionary = i18n.getDictionary(ctx.locale)
  const entry = dictionary.commands.roleplay[action]

  const authorMention = `<@${author.id}>`
  const targetMention = `<@${targetId}>`

  const titles = entry.title
  const descriptions = entry.description(authorMention, targetMention)
  const index = randomInt(0, Math.max(1, titles.length))

  const title = titles[index] ?? titles[0] ?? ''
  const description = descriptions[index] ?? descriptions[0] ?? ''

  await ctx.reply({
    embeds: [
      Embed({
        title,
        description,
        color: colors.primary,
        image: media?.url,
        footer: media
          ? {
              text: `Anime: ${media.anime_name} · ${media.dimensions.width}x${media.dimensions.height}`,
            }
          : undefined,
      }),
    ],
    allowedMentions: {
      parse: [],
      users: [author.id, targetId],
      roles: [],
      repliedUser: false,
    },
  })
}

export function createRoleplayCommand(options: RoleplayCommandConfig) {
  return createCommand({
    name: options.action,
    description: options.description,
    descriptionLocalizations: options.descriptionLocalizations,
    category: Category.Fun,
    aliases: options.aliases,
    usage: `{prefix}${options.action} <@user|id>`,
    async run(ctx) {
      await runRoleplayAction(ctx, options.action)
    },
  })
}
