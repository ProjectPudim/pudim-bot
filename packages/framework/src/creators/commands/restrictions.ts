import {
  PermissionsBitField,
  type GuildChannel,
  type GuildMember,
  type PermissionResolvable,
  type PermissionString,
} from '@fluxerjs/core'
import { CommandFailureError } from './failures'
import type { AnyCommand, CommandContext } from './types'

function resolveMissingPermissions(
  member: GuildMember | null,
  channel: GuildChannel | null,
  required: PermissionResolvable,
): PermissionString[] {
  if (!member) {
    return new PermissionsBitField(0).missing(required)
  }

  let perms = member.permissions
  if (channel && typeof member.permissionsIn === 'function') {
    try {
      perms = member.permissionsIn(channel)
    } catch {
      // Fall back to guild-wide permissions
    }
  }

  return perms instanceof PermissionsBitField
    ? perms.missing(required)
    : new PermissionsBitField(0).missing(required)
}

export async function runRestrictions(
  command: AnyCommand,
  ctx: CommandContext,
  effectiveOwnerIds: readonly string[],
): Promise<void> {
  const contextMode = command.context ?? 'both'
  const actualContext: 'guild' | 'dm' = ctx.guildId ? 'guild' : 'dm'

  if (contextMode !== 'both' && contextMode !== actualContext) {
    throw new CommandFailureError({
      kind: 'context',
      code: 'INVALID_CONTEXT',
      expected: contextMode,
      actual: actualContext,
    })
  }

  if (command.ownerOnly && !effectiveOwnerIds.includes(ctx.author.id)) {
    throw new CommandFailureError({
      kind: 'owner',
      code: 'OWNER_ONLY',
    })
  }

  const channel = ctx.channel as unknown as GuildChannel | null

  if (command.userPermissions) {
    const member = ctx.message.member ?? (await ctx.resolveMember())
    const missing = resolveMissingPermissions(
      member,
      channel,
      command.userPermissions,
    )

    if (!member || missing.length > 0) {
      throw new CommandFailureError({
        kind: 'permissions',
        code: 'MISSING_PERMISSIONS',
        target: 'user',
        missing,
      })
    }
  }

  if (command.botPermissions) {
    const guild = ctx.guild
    let botMember = guild?.members?.me ?? null
    if (!botMember && guild) {
      try {
        botMember = await guild.members.fetch(ctx.client.user?.id ?? '')
      } catch (error) {
        throw new Error('[commands] Failed to resolve bot member.', {
          cause: error,
        })
      }
    }

    const missing = resolveMissingPermissions(
      botMember,
      channel,
      command.botPermissions,
    )

    if (!botMember || missing.length > 0) {
      throw new CommandFailureError({
        kind: 'permissions',
        code: 'MISSING_PERMISSIONS',
        target: 'bot',
        missing,
      })
    }
  }
}
