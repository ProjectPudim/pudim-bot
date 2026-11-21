import type { GuildMember, Role } from '@fluxerjs/core'
import { Autorole } from '@pudim/database'
import { createEvent } from '#bot/fluxer'
import { logger } from '#bot/utils/logger'

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

export default createEvent({
  name: 'guildMemberAdd',
  async run(client, member: GuildMember) {
    try {
      const guild = member.guild
      if (!guild) return

      const doc = await Autorole.findOne({ guildId: guild.id })
        .lean()
        .catch(() => null)
      if (!doc) return

      const roleIds = new Set<string>()
      if (member.user.bot) {
        if (doc.apps) roleIds.add(doc.apps)
        if (doc.all) roleIds.add(doc.all)
      } else {
        if (doc.users) roleIds.add(doc.users)
        if (doc.all) roleIds.add(doc.all)
      }

      if (roleIds.size === 0) return

      const roles = await guild.fetchRoles().catch(() => [])
      const botMember =
        guild.members.me ??
        (await guild.members.fetch(client.user!.id).catch(() => null))
      const botHighest = highestPosition(botMember, roles, guild.id)

      for (const roleId of roleIds) {
        try {
          const role =
            roles.find((r) => r.id === roleId) ??
            (await guild.fetchRole(roleId).catch(() => null))
          if (!role) {
            logger.warn(
              `[autorole] Role ${roleId} no longer exists in guild ${guild.id}`,
            )
            continue
          }

          if ((role as unknown as { managed?: boolean }).managed === true) {
            logger.warn(
              `[autorole] Role ${roleId} is managed by an integration in guild ${guild.id}`,
            )
            continue
          }

          if (botHighest === -1 || role.position >= botHighest) {
            logger.warn(
              `[autorole] Role ${roleId} is above the bot's highest role in guild ${guild.id}`,
            )
            continue
          }

          await member.roles.add(roleId)
        } catch (error) {
          logger.error(
            `[autorole] Failed to assign role ${roleId} to member ${member.id}`,
            error,
          )
        }
      }
    } catch (error) {
      logger.error('[autorole] Unhandled error in guildMemberAdd', error)
    }
  },
})
