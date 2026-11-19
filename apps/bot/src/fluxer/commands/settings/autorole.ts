import type { GuildMember, Role } from '@fluxerjs/core'
import { Autorole } from '@pudim/database'
import { Category } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { parseRoleId } from '#bot/utils'
import { logger } from '#bot/utils/logger'

type CategoryKey = 'all' | 'users' | 'apps'

const VALID_CATEGORIES: readonly CategoryKey[] = ['all', 'users', 'apps']

function isCategory(value: string | undefined): value is CategoryKey {
  return (
    value !== undefined &&
    (VALID_CATEGORIES as readonly string[]).includes(value.toLowerCase())
  )
}

function normalizeCategory(value: string): CategoryKey {
  return value.toLowerCase() as CategoryKey
}

function categoryLabel(category: CategoryKey): string {
  if (category === 'all') return 'usuários e aplicativos'
  if (category === 'users') return 'usuários'
  return 'aplicativos'
}

function highestPosition(
  member: GuildMember | null,
  roles: Role[],
  guildId: string,
): number {
  let max = -1
  const roleIds = member?.roles.roleIds ?? []
  for (const id of roleIds) {
    const role = roles.find((r) => r.id === id)
    if (role && role.position > max) max = role.position
  }
  const everyone = roles.find((r) => r.id === guildId)
  if (everyone && everyone.position > max) max = everyone.position
  return max
}

export default createCommand({
  name: 'autorole',
  description: 'Manages automatic roles for members joining the server.',
  descriptionLocalizations: {
    'pt-BR': 'Gerencia cargos automáticos para membros que entram no servidor.',
  },
  category: Category.Settings,
  usage: '{prefix}autorole [all|users|apps|off] [@role]',
  context: 'guild',
  userPermissions: 'ManageGuild',
  async run(ctx) {
    const { t, args, author, client, guildId } = ctx
    const tr = t as (key: string, ...args: unknown[]) => string
    if (!guildId) return

    const guild = await client.guilds.fetch(guildId).catch(() => null)
    if (!guild) {
      await ctx.reply({
        content: t('common.notFound.messages.server', guildId),
      })
      return
    }

    const roles = await guild.fetchRoles().catch(() => [])

    // Status (no args)
    if (args.length === 0) {
      const doc = await Autorole.findOne({ guildId })
        .lean()
        .catch(() => null)
      const allRole = doc?.all ? `<@&${doc.all}>` : 'desligado'
      const usersRole = doc?.users ? `<@&${doc.users}>` : 'desligado'
      const appsRole = doc?.apps ? `<@&${doc.apps}>` : 'desligado'

      await ctx.reply({
        content: t(
          'commands.autorole.messages.status',
          `<@${author.id}>`,
          allRole,
          usersRole,
          appsRole,
        ),
        allowedMentions: { parse: [], users: [author.id], roles: [] },
      })
      return
    }

    // Disable flow
    if (args[0]?.toLowerCase() === 'off') {
      const rawCategory = args[1]?.toLowerCase()
      if (!isCategory(rawCategory)) {
        await ctx.reply({
          content: t('commands.autorole.messages.errors.missingCategory'),
        })
        return
      }
      const category = normalizeCategory(rawCategory)

      const doc = await Autorole.findOne({ guildId })
        .lean()
        .catch(() => null)
      const current = doc?.[category] ?? null
      if (!current) {
        await ctx.reply({
          content: t(
            'commands.autorole.messages.errors.alreadyDisabled',
            categoryLabel(category),
          ),
          allowedMentions: { parse: [] },
        })
        return
      }

      try {
        await Autorole.updateOne({ guildId }, { $set: { [category]: null } })
      } catch (error) {
        logger.error('[autorole] Failed to disable category', error)
      }

      await ctx.reply({
        content: tr(`commands.autorole.messages.disabled.${category}`),
        allowedMentions: { parse: [] },
      })
      return
    }

    // Configure flow
    const rawCategory = args[0]?.toLowerCase()
    if (!isCategory(rawCategory)) {
      await ctx.reply({
        content: t('commands.autorole.messages.errors.invalidCategory'),
      })
      return
    }
    const category = normalizeCategory(rawCategory)

    const roleInput = args.slice(1).join(' ').trim()
    if (!roleInput) {
      await ctx.reply({
        content: t('commands.autorole.messages.errors.missingArgs'),
      })
      return
    }

    // Resolve role
    const roleId = parseRoleId(roleInput)
    let role: Role | null = null
    if (roleId) {
      role =
        roles.find((r) => r.id === roleId) ??
        (await guild.fetchRole(roleId).catch(() => null))
    }
    if (!role) {
      const needle = roleInput.toLowerCase()
      role =
        roles.find((r) => r.name.toLowerCase() === needle) ??
        roles.find((r) => r.name.toLowerCase().includes(needle)) ??
        null
    }

    if (!role) {
      await ctx.reply({
        content: t('common.notFound.messages.role', roleInput),
        allowedMentions: { parse: [] },
      })
      return
    }

    // Validations
    if (role.id === guild.id) {
      await ctx.reply({
        content: t('commands.autorole.messages.errors.invalidRoleManaged'),
        allowedMentions: { parse: [] },
      })
      return
    }

    // Managed by integration (best effort)
    if ((role as unknown as { managed?: boolean }).managed === true) {
      await ctx.reply({
        content: t('commands.autorole.messages.errors.invalidRoleManaged'),
        allowedMentions: { parse: [] },
      })
      return
    }

    // Bot hierarchy
    const botMember =
      guild.members.me ??
      (await guild.members.fetch(client.user!.id).catch(() => null))
    const botHighest = highestPosition(botMember, roles, guild.id)
    if (botHighest === -1 || role.position >= botHighest) {
      await ctx.reply({
        content: t('commands.autorole.messages.errors.roleAboveBot'),
        allowedMentions: { parse: [] },
      })
      return
    }

    // Author hierarchy (except owner)
    if (author.id !== guild.ownerId) {
      const authorMember =
        ctx.member ?? (await ctx.resolveMember().catch(() => null))
      const authorHighest = highestPosition(authorMember, roles, guild.id)
      if (role.position >= authorHighest) {
        await ctx.reply({
          content: t('commands.autorole.messages.errors.roleAboveAuthor'),
          allowedMentions: { parse: [] },
        })
        return
      }
    }

    // Save
    try {
      await Autorole.updateOne(
        { guildId },
        { $set: { [category]: role.id } },
        { upsert: true },
      )
    } catch (error) {
      logger.error('[autorole] Failed to save category', error)
    }

    const roleMention = `<@&${role.id}>`
    const successKey = `commands.autorole.messages.success.${category}`
    await ctx.reply({
      content: tr(successKey, roleMention),
      allowedMentions: { parse: [], roles: [] },
    })
  },
})
