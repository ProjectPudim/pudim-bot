import type { CommandContext } from '@pudim/framework'
import { http } from '@pudim/shared/http'
import { env } from '#bot/env'
import { i18n } from '#bot/i18n'
import { colors } from '#bot/utils/constants'
import { Embed } from '#bot/utils/embed'
import { parseTargetId } from '#bot/utils/user'

export type ActionTypes =
  | 'bonk'
  | 'feed'
  | 'hug'
  | 'kiss'
  | 'pat'
  | 'poke'
  | 'punch'
  | 'slap'
  | 'wave'
  | 'yeet'

export interface NekosBestApiResponse {
  results: {
    anime_name: string
    url: string
    dimensions: {
      width: number
      height: number
    }
  }[]
}

export class RoleplayManager {
  private readonly API_URL = env.ROLEPLAY_API_URL

  public isEnabled(): boolean {
    return Boolean(this.API_URL)
  }

  public async getActionDetails(action: ActionTypes) {
    if (!this.isEnabled()) {
      return undefined
    }

    try {
      const response = await http.get<NekosBestApiResponse>(
        `${this.API_URL}/${action}`,
      )

      return response.data.results[0]
    } catch {
      return undefined
    }
  }

  public async command(
    ctx: CommandContext,
    type: ActionTypes,
    _usage: string,
  ): Promise<void> {
    const { args, author, t } = ctx

    const targetId = parseTargetId(args[0])

    if (!targetId) {
      await ctx.reply({
        content: t('commands.roleplay.messages.invalidUsage'),
      })

      return
    }

    const data = await this.getActionDetails(type)

    const lang = i18n.getDictionary(ctx.locale)
    const entry = lang.commands.roleplay[type]

    const authorMention = `<@${author.id}>`
    const targetMention = `<@${targetId}>`

    const titles = entry.title
    const descriptions = entry.description(authorMention, targetMention)

    const index = Math.floor(Math.random() * titles.length)

    const title = titles[index] ?? titles[0] ?? ''
    const description = descriptions[index] ?? descriptions[0] ?? ''

    await ctx.reply({
      embeds: [
        Embed({
          title,
          description,
          color: colors.primary,
          image: data?.url,
          footer: data
            ? {
                text: `Anime: ${data.anime_name} · ${data.dimensions.width}x${data.dimensions.height}`,
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
}

export const roleplayManager = new RoleplayManager()
