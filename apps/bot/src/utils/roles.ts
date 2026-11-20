import type { Rest, RestMember, RestRole } from '@pudim/shared/types'

export type RoleCheckFailure =
  'roleNotFound' | 'everyone' | 'managed' | 'missingPermission' | 'hierarchy'

export type RoleCheck = { ok: true } | { ok: false; reason: RoleCheckFailure }

const PERMS = {
  ADMINISTRATOR: 1n << 3n,
  MANAGE_ROLES: 1n << 28n,
}

export async function checkRoleAssignable(
  rest: Rest,
  guildId: string,
  userId: string,
  roleId: string,
): Promise<RoleCheck> {
  const [roles, member, guild] = await Promise.all([
    rest.get(`/guilds/${guildId}/roles`) as Promise<
      (RestRole & { permissions?: string; managed?: boolean })[]
    >,
    rest.get(`/guilds/${guildId}/members/${userId}`) as Promise<RestMember>,
    rest.get(`/guilds/${guildId}`) as Promise<{ owner_id?: string }>,
  ])

  const target = roles.find((role) => role.id === roleId)
  if (!target) return { ok: false, reason: 'roleNotFound' }
  if (target.id === guildId) return { ok: false, reason: 'everyone' }
  if (target.managed) return { ok: false, reason: 'managed' }
  if (guild.owner_id === userId) return { ok: true }

  const memberRoles = roles.filter((role) => member.roles.includes(role.id))

  let permissions = BigInt(
    roles.find((role) => role.id === guildId)?.permissions ?? 0,
  )
  for (const role of memberRoles) permissions |= BigInt(role.permissions ?? 0)

  if ((permissions & (PERMS.ADMINISTRATOR | PERMS.MANAGE_ROLES)) === 0n) {
    return { ok: false, reason: 'missingPermission' }
  }

  const highest = Math.max(0, ...memberRoles.map((role) => role.position))
  if (highest <= target.position) return { ok: false, reason: 'hierarchy' }

  return { ok: true }
}

export async function toggleRole(
  rest: Rest,
  guildId: string,
  userId: string,
  roleId: string,
): Promise<'added' | 'removed'> {
  const member = (await rest.get(
    `/guilds/${guildId}/members/${userId}`,
  )) as RestMember
  const route = `/guilds/${guildId}/members/${userId}/roles/${roleId}`

  if (member.roles.includes(roleId)) {
    await rest.delete(route)
    return 'removed'
  }

  await rest.put(route)
  return 'added'
}
