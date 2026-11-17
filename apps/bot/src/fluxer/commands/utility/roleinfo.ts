import { Category, colors } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import {
  Embed,
  formatTimestampPair,
  parseRoleId,
  safeReplyMentions,
} from '#bot/utils'

export default createCommand({
  name: 'roleinfo',
  description: 'Shows information about a role.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre um cargo.',
    'es-ES': 'Muestra información sobre un rol.',
  },
  category: Category.Utilities,
  usage: '{prefix}roleinfo <@role|id|name>',
  aliases: ['role', 'rinfo'],
  context: 'guild',
  async run(ctx) {
    const { t, args, author, client, guildId } = ctx
    if (!guildId) return

    const input = args.join(' ').trim()
    if (!input) {
      await ctx.reply({
        content: t('commands.roleinfo.messages.invalidUsage'),
      })
      return
    }

    const guild = await client.guilds.fetch(guildId).catch(() => null)
    if (!guild) {
      await ctx.reply({
        content: t('common.notFound.messages.server', guildId),
      })
      return
    }

    const roles = await guild.fetchRoles().catch(() => [])
    const roleId = parseRoleId(args[0] ?? input)

    let role = roleId
      ? (roles.find((r) => r.id === roleId) ??
        (await guild.fetchRole(roleId).catch(() => null)))
      : null

    if (!role) {
      const needle = input.toLowerCase()
      role =
        roles.find((r) => r.name.toLowerCase() === needle) ??
        roles.find((r) => r.name.toLowerCase().includes(needle)) ??
        null
    }

    if (!role) {
      await ctx.reply({
        content: t('common.notFound.messages.role', input),
      })
      return
    }

    const createdText = formatTimestampPair(role.createdAt) ?? '—'
    const colorHex = role.color
      ? `#${role.color.toString(16).padStart(6, '0')}`
      : t('commands.roleinfo.labels.noColor')

    const perms = role.permissions.toArray()
    const permText = perms.length
      ? perms.map((p) => t(`common.permissions.${p}`)).join(', ')
      : t('commands.roleinfo.noPermissions')

    const lines: string[] = [
      `**${t('commands.roleinfo.labels.name')}:** ${role.name} (<@&${role.id}>)`,
      `**${t('commands.roleinfo.labels.id')}:** \`${role.id}\``,
      `**${t('commands.roleinfo.labels.color')}:** ${colorHex}`,
      `**${t('commands.roleinfo.labels.position')}:** ${role.position}`,
      `**${t('commands.roleinfo.labels.created')}:** ${createdText}`,
      `**${t('commands.roleinfo.labels.hoist')}:** ${role.hoist ? t('commands.roleinfo.values.yes') : t('commands.roleinfo.values.no')}`,
      `**${t('commands.roleinfo.labels.mentionable')}:** ${role.mentionable ? t('commands.roleinfo.values.yes') : t('commands.roleinfo.values.no')}`,
      `**${t('commands.roleinfo.labels.permissions')}:** ${permText}`,
    ]

    const embed = Embed({
      author: { name: t('commands.roleinfo.title') },
      description: lines,
      color: role.color ? colorHex : colors.primary,
    })

    await ctx.reply({
      embeds: [embed],
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
