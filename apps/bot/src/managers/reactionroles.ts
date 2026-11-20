import type { CommandContext } from '@pudim/framework'
import { colors } from '#bot/config'
import { reactionManager } from '#bot/managers/reaction'
import {
  checkRoleAssignable,
  Embed,
  findMessageChannel,
  toggleRole,
} from '#bot/utils'
import {
  emojiIdentity,
  emojiRoute,
  parseEmoji,
  type ParsedEmoji,
} from '#bot/utils/emojis'
import { parseMessageReference, parseRoleId } from '#bot/utils/resolvers'

type Mode = 'add' | 'remove'
type RoleState = { roles: Record<string, string> }

const MODES: Record<string, Mode> = {
  add: 'add',
  adicionar: 'add',
  remove: 'remove',
  rem: 'remove',
  remover: 'remove',
}

const keyOf = (emoji: ParsedEmoji) => `rr:${emoji.raw}`

// A single action covers all reaction roles: key "rr:<emoji>" and role in state.
reactionManager.registry<RoleState>({
  key: 'rr:*',
  emoji: (key) => key.slice(3),
  filter: reactionManager.filters.anyone,
  concurrent: true,
  cooldownMs: 2000,
  process: 'multiple',
  async run(ctx) {
    const roleId = ctx.state.roles?.[ctx.key]
    if (!roleId || !ctx.guildId) return

    await toggleRole(ctx.rest, ctx.guildId, ctx.clickerId, roleId)
  },
})

export class ReactionRoleManager {
  async command(ctx: CommandContext, USAGE: string) {
    const { guildId, channelId, client } = ctx

    if (!guildId) {
      await ctx.reply({
        content: ctx.t('common.context.guildOnly'),
      })
      return
    }

    const args = [...ctx.args]
    const mode = MODES[args[0]?.toLowerCase() ?? ''] ?? null
    if (mode) args.shift()

    const [messageReferenceInput, emojiInput, roleInput] = args
    const action: Mode = mode ?? 'add'

    if (
      !messageReferenceInput ||
      !emojiInput ||
      (action === 'add' && !roleInput)
    ) {
      await ctx.reply({
        content: ctx.t('common.invalidCommandUsage', USAGE),
      })
      return
    }

    const reference = parseMessageReference(messageReferenceInput)
    if (!reference) {
      await ctx.reply({
        content: ctx.t('common.invalidMessageId'),
      })
      return
    }

    if (reference.guildId && reference.guildId !== guildId) {
      await ctx.reply({
        content: ctx.t('commands.reactionroles.messageNotFound'),
      })
      return
    }

    const messageId = reference.messageId

    const emoji = parseEmoji(emojiInput)
    if (!emoji) {
      await ctx.reply({
        content: ctx.t('common.invalidEmoji'),
      })
      return
    }

    if (action === 'remove') {
      await this.remove(ctx, guildId, messageId, emoji)
      return
    }

    const roleId = parseRoleId(roleInput)
    if (!roleId) {
      await ctx.reply({
        content: ctx.t('common.invalidRole'),
      })
      return
    }

    const binding = await reactionManager.get<RoleState>(messageId)
    if (binding) {
      if (binding.guildId !== guildId) {
        await ctx.reply({
          content: ctx.t('commands.reactionroles.messageNotFound'),
        })
        return
      }

      if (!binding.state.roles) {
        await ctx.reply({
          embeds: [
            Embed({
              title: ctx.t('commands.reactionroles.title.conflict'),
              description: ctx.t('commands.reactionroles.managedByOther'),
              color: colors.warning,
            }),
          ],
        })
        return
      }

      const sameEmoji = Object.entries(binding.state.roles).find(
        ([key]) => emojiIdentity(key.slice(3)) === emoji.id,
      )
      if (sameEmoji) {
        await ctx.reply({
          embeds: [
            Embed({
              title: ctx.t('commands.reactionroles.title.conflict'),
              description: ctx.t(
                'commands.reactionroles.emojiInUse',
                emoji.display,
                `<@&${sameEmoji[1]}>`,
              ),
              color: colors.warning,
            }),
          ],
        })
        return
      }

      if (Object.values(binding.state.roles).includes(roleId)) {
        await ctx.reply({
          embeds: [
            Embed({
              title: ctx.t('commands.reactionroles.title.conflict'),
              description: ctx.t(
                'commands.reactionroles.roleInUse',
                `<@&${roleId}>`,
              ),
              color: colors.warning,
            }),
          ],
        })
        return
      }
    }

    let messageChannelId: string
    if (reference.channelId) {
      const found = await client.rest
        .get(`/channels/${reference.channelId}/messages/${messageId}`)
        .then(() => reference.channelId!)
        .catch(() => null)
      if (!found) {
        await ctx.reply({
          content: ctx.t('commands.reactionroles.messageNotFound'),
        })
        return
      }
      messageChannelId = found
    } else {
      const found = await findMessageChannel(
        client.rest,
        guildId,
        messageId,
        channelId,
      )
      if (!found) {
        await ctx.reply({
          content: ctx.t('commands.reactionroles.messageNotFound'),
        })
        return
      }
      messageChannelId = found
    }

    const check = await checkRoleAssignable(
      client.rest,
      guildId,
      client.user!.id,
      roleId,
    )
    if (!check.ok) {
      await ctx.reply({
        content: ctx.t(
          `commands.reactionroles.error.${check.reason}`,
          `<@&${roleId}>`,
        ),
      })
      return
    }

    try {
      await client.rest.put(
        `/channels/${messageChannelId}/messages/${messageId}/reactions/${emojiRoute(emoji.raw)}/@me`,
      )
    } catch {
      await ctx.reply({
        content: ctx.t('commands.reactionroles.reactionFailed'),
      })
      return
    }

    const key = keyOf(emoji)

    if (binding) {
      await reactionManager.edit<RoleState>(client, messageId, (draft) => {
        draft.state.roles ??= {}
        draft.state.roles[key] = roleId
        draft.keys.push(key)
      })
    } else {
      await reactionManager.bind<RoleState>(
        { id: messageId },
        {
          client,
          channelId: messageChannelId,
          guildId,
          keys: [key],
          state: { roles: { [key]: roleId } },
          permanent: true,
        },
      )
    }

    const messageUrl = `https://web.fluxer.app/channels/${guildId}/${messageChannelId}/${messageId}`
    await ctx.reply({
      content: ctx.t(
        'commands.reactionroles.added',
        emoji.display,
        `<@&${roleId}>`,
        messageUrl,
      ),
      allowedMentions: {
        parse: [],
        users: [ctx.author.id],
        roles: [],
        repliedUser: true,
      },
    })
  }

  private async remove(
    ctx: CommandContext,
    guildId: string,
    messageId: string,
    emoji: ParsedEmoji,
  ) {
    const key = keyOf(emoji)
    const binding = await reactionManager.get<RoleState>(messageId)

    const removedRole = binding?.state.roles?.[key]

    if (binding?.guildId !== guildId || !binding.state.roles?.[key]) {
      await ctx.reply({
        embeds: [
          Embed({
            title: ctx.t('errors.notFound'),
            description: ctx.t('commands.reactionroles.notFound'),
            color: colors.danger,
          }),
        ],
      })
      return
    }

    await reactionManager.edit<RoleState>(ctx.client, messageId, (draft) => {
      delete draft.state.roles[key]
      draft.keys = draft.keys.filter((k) => k !== key)
    })

    const messageUrl = `https://web.fluxer.app/channels/${guildId}/${binding?.channelId ?? ctx.channelId}/${messageId}`
    await ctx.reply({
      content: ctx.t(
        'commands.reactionroles.removed',
        emoji.display,
        messageUrl,
        `<@&${removedRole}>`,
      ),
      allowedMentions: {
        parse: [],
        users: [ctx.author.id],
        roles: [],
        repliedUser: true,
      },
    })
  }
}

export const reactionRoleManager = new ReactionRoleManager()
