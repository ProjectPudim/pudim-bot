import type { CommandContext } from '@pudim/framework'
import { colors } from '#bot/config'
import { Embed, type EmbedField } from '#bot/utils'

export const GIVEAWAY_COMMANDS = {
  create: '[#channel|id] <duration> <winners> <prize> [flags]',
  reroll: '<messageUrl>',
  cancel: '<messageUrl>',
} as const
export type GiveawayCommand = keyof typeof GIVEAWAY_COMMANDS

export const GIVEAWAY_FLAGS = {
  title: '<text>',
  description: '<text>',
  color: '<hex>',
  emoji: '<emoji>',
  image: '<url>',
  thumbnail: '<url>',
  host: '<user|id>',
  requiredRoles: '<roles>',
  requiredJoinedAt: '<duration>',
  requiredAccountAge: '<duration>',
  requiredServer: '<invite|serverId>',
} as const

export function giveawayUsage(prefix: string, sub: GiveawayCommand) {
  return `${prefix}giveaway ${sub} ${GIVEAWAY_COMMANDS[sub]}`.trim()
}

export const GIVEAWAY_USAGE = (
  Object.keys(GIVEAWAY_COMMANDS) as GiveawayCommand[]
)
  .map((sub) => giveawayUsage('{prefix}', sub))
  .join('\n')

export function giveawayHelp(
  ctx: Pick<CommandContext, 't' | 'prefix'>,
  sub?: GiveawayCommand,
) {
  const { t, prefix } = ctx
  const commands = sub
    ? [sub]
    : (Object.keys(GIVEAWAY_COMMANDS) as GiveawayCommand[])
  const fields: EmbedField[] = [
    {
      name: t('commands.giveaway.usage.commands'),
      value: commands
        .map((name) => `- \`${giveawayUsage('', name)}\``)
        .join('\n'),
    },
    {
      name: t('commands.giveaway.usage.arguments'),
      value: t(
        sub && sub !== 'create'
          ? 'commands.giveaway.usage.messageArgument'
          : 'commands.giveaway.usage.argumentsDescription',
      ),
      inline: true,
    },
    {
      name: t('commands.giveaway.usage.requirements'),
      value: t('commands.giveaway.usage.requirementsDescription'),
      inline: true,
    },
  ]
  if (!sub || sub === 'create') {
    const lines = (
      Object.keys(GIVEAWAY_FLAGS) as (keyof typeof GIVEAWAY_FLAGS)[]
    ).map(
      (flag) =>
        `- \`--${flag} ${GIVEAWAY_FLAGS[flag]}\`: ${t(`commands.giveaway.flags.${flag}`)}`,
    )
    for (let start = 0; start < lines.length; start += 6) {
      fields.push({
        name: t('commands.giveaway.usage.flags'),
        value: lines.slice(start, start + 6).join('\n'),
      })
    }
    fields.push({
      name: t('commands.giveaway.usage.participation'),
      value: t('commands.giveaway.usage.participationText'),
    })
  }
  fields.push({
    name: t('commands.giveaway.usage.examples'),
    value: t('commands.giveaway.usage.example', prefix, sub ?? 'create'),
  })
  return Embed({
    title: t('commands.giveaway.usage.title'),
    description: t('commands.giveaway.usage.description'),
    fields,
    color: colors.primary,
  })
}
