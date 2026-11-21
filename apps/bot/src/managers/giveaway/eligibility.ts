import type { Client } from '@fluxerjs/core'
import type { GiveawayRecord } from '@pudim/database'
import { accountCreatedAt, freshMember } from './helpers'

export type Eligibility =
  | { eligible: true }
  | {
      eligible: false
      reason:
        'bot' | 'member' | 'roles' | 'joined' | 'account' | 'server' | 'pending'
      roles?: string[]
    }

export async function validateRequirements(
  client: Client,
  giveaway: GiveawayRecord,
  userId: string,
  now = Date.now(),
): Promise<Eligibility> {
  if (userId === client.user?.id) return { eligible: false, reason: 'bot' }
  try {
    const operationId = String(giveaway._id)
    const member = await freshMember(
      client,
      giveaway.guildId,
      userId,
      operationId,
    )
    if (!member) return { eligible: false, reason: 'member' }
    if (member.user?.bot) return { eligible: false, reason: 'bot' }
    const missing = giveaway.requiredRoleIds.filter(
      (role) => role !== giveaway.guildId && !member.roles.includes(role),
    )
    if (missing.length)
      return { eligible: false, reason: 'roles', roles: missing }
    if (giveaway.requiredJoinedDuration) {
      const joined = Date.parse(member.joined_at)
      if (!Number.isFinite(joined))
        return { eligible: false, reason: 'pending' }
      if (now - joined < giveaway.requiredJoinedDuration)
        return { eligible: false, reason: 'joined' }
    }
    if (giveaway.requiredAccountAgeDuration) {
      const created = accountCreatedAt(client, member.user!)
      if (created === null) return { eligible: false, reason: 'pending' }
      if (now - created < giveaway.requiredAccountAgeDuration)
        return { eligible: false, reason: 'account' }
    }
    if (giveaway.requiredServerId) {
      if (
        !client.user?.id ||
        !(await freshMember(
          client,
          giveaway.requiredServerId,
          client.user.id,
          operationId,
        ))
      )
        return { eligible: false, reason: 'pending' }
      const requiredMember = await freshMember(
        client,
        giveaway.requiredServerId,
        userId,
        operationId,
      )
      if (!requiredMember) return { eligible: false, reason: 'server' }
    }
    return { eligible: true }
  } catch {
    return { eligible: false, reason: 'pending' }
  }
}
