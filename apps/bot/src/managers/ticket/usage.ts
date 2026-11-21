import { DEFAULT_TICKET_NAME_PATTERN } from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import { colors, config, emojis } from '#bot/config'
import { Embed, type EmbedField } from '#bot/utils'
import { EMBED_ALIASES, type EmbedExcludeArgs } from '#bot/utils/embed'
import {
  TICKET_NAME_VARIABLE_ALIASES,
  TICKET_NAME_VARIABLE_LIST,
} from './helpers'
import { welcomeVariableHelp } from './welcome'

export const PANEL_EMBED_EXCLUDE = [
  'author.name',
  'author.icon',
  'author.url',
  'footer.text',
  'footer.icon',
  'timestamp',
] as const satisfies readonly EmbedExcludeArgs[]
export const WELCOME_EMBED_EXCLUDE = [
  'timestamp',
] as const satisfies readonly EmbedExcludeArgs[]

export const TICKET_USAGE_KEYS = [
  'channel',
  'category',
  'category.open',
  'category.closed',
  'close',
  'close.action',
  'close.delay',
  'close.emoji',
  'close.opener',
  'close.dm',
  'panel',
  'option',
  'option.add',
  'option.remove',
  'option.list',
  'staffrole',
  'staffrole.add',
  'staffrole.remove',
  'logchannel',
  'namepattern',
  'welcome',
  'blacklist',
  'blacklist.add',
  'blacklist.remove',
  'config',
  'reopen',
  'add',
  'remove',
  'transfer',
] as const
export type TicketUsageKey = (typeof TICKET_USAGE_KEYS)[number]

type TicketSubcommand = {
  lines: readonly string[]
  children?: readonly TicketUsageKey[]
}

export const TICKET_SUBCOMMANDS: Record<TicketUsageKey, TicketSubcommand> = {
  channel: { lines: ['ticket channel <#channel|id>'] },
  category: { lines: ['ticket category <#category|id> <open|closed>'] },
  'category.open': { lines: ['ticket category <#category|id> open'] },
  'category.closed': { lines: ['ticket category <#category|id> closed'] },
  panel: {
    lines: [
      'ticket panel --title ...',
      'ticket panel send',
      'ticket panel update',
      'ticket panel preview',
    ],
  },
  option: {
    lines: [],
    children: ['option.add', 'option.remove', 'option.list'],
  },
  'option.add': { lines: ['ticket option add <reaction> <name>'] },
  'option.remove': { lines: ['ticket option remove <reaction>'] },
  'option.list': { lines: ['ticket option list'] },
  close: {
    lines: ['ticket close [motivo]'],
    children: [
      'close.action',
      'close.delay',
      'close.emoji',
      'close.opener',
      'close.dm',
    ],
  },
  'close.action': { lines: ['ticket close action <delete|archive>'] },
  'close.delay': { lines: ['ticket close delay <seconds>'] },
  'close.emoji': { lines: ['ticket close emoji <emoji>'] },
  'close.opener': { lines: ['ticket close opener <on|off>'] },
  'close.dm': { lines: ['ticket close dm <on|off>'] },
  reopen: { lines: ['ticket reopen <number|#channel>'] },
  add: { lines: ['ticket add <@user>'] },
  remove: { lines: ['ticket remove <@user>'] },
  transfer: { lines: ['ticket transfer <@staff>'] },
  staffrole: { lines: ['ticket staffrole <add|remove> <@role>'] },
  'staffrole.add': { lines: ['ticket staffrole add <@role>'] },
  'staffrole.remove': { lines: ['ticket staffrole remove <@role>'] },
  logchannel: { lines: ['ticket logchannel <#channel|id>'] },
  namepattern: { lines: ['ticket namepattern <pattern>'] },
  welcome: { lines: ['ticket welcome --title ...', 'ticket welcome preview'] },
  blacklist: { lines: ['ticket blacklist <add|remove> <@user>'] },
  'blacklist.add': { lines: ['ticket blacklist add <@user>'] },
  'blacklist.remove': { lines: ['ticket blacklist remove <@user>'] },
  config: { lines: ['ticket config'] },
}

const GENERAL_USAGE_KEYS: readonly TicketUsageKey[] = [
  'channel',
  'category',
  'panel',
  'option',
  'close',
  'reopen',
  'add',
  'remove',
  'transfer',
  'staffrole',
  'logchannel',
  'namepattern',
  'welcome',
  'blacklist',
  'config',
]

function usageLines(key: TicketUsageKey): string[] {
  const entry = TICKET_SUBCOMMANDS[key]
  return [...entry.lines, ...(entry.children ?? []).flatMap(usageLines)]
}

export const TICKET_USAGE = GENERAL_USAGE_KEYS.flatMap(usageLines)
  .map((line) => `{prefix}${line}`)
  .join('\n')

export async function replyUsage(
  ctx: CommandContext,
  key?: TicketUsageKey,
): Promise<void> {
  const { t } = ctx
  const fields: EmbedField[] = []
  if (key) {
    fields.push({
      name: t('commands.ticket.usage.howToUse'),
      value: usageLines(key)
        .map((line) => `- \`${line}\``)
        .join('\n'),
    })
    const argumentsText = t(`commands.ticket.usage.${key}.arguments`)
    if (argumentsText)
      fields.push({
        name: t('commands.ticket.usage.arguments'),
        value: argumentsText,
      })
    const notes = t(`commands.ticket.usage.${key}.notes`)
    if (notes)
      fields.push({ name: t('commands.ticket.usage.details'), value: notes })
    if (key === 'namepattern') {
      fields.push(
        {
          name: t('commands.ticket.usage.defaults'),
          value: t(
            'commands.ticket.usage.namepattern.defaults',
            DEFAULT_TICKET_NAME_PATTERN,
          ),
        },
        {
          name: t('commands.ticket.usage.variables'),
          value: t(
            'commands.ticket.usage.namepattern.variables',
            TICKET_NAME_VARIABLE_LIST,
            TICKET_NAME_VARIABLE_ALIASES.map((name) => `\`{${name}}\``).join(
              ', ',
            ),
          ),
        },
      )
    }
    if (key === 'panel' || key === 'welcome') {
      const exclude: readonly EmbedExcludeArgs[] =
        key === 'panel' ? PANEL_EMBED_EXCLUDE : WELCOME_EMBED_EXCLUDE
      fields.push({
        name: t('commands.ticket.usage.embedFlags'),
        value: Object.keys(EMBED_ALIASES)
          .filter((name) => !exclude.includes(name as EmbedExcludeArgs))
          .map((name) => `\`--${name}\``)
          .join(', '),
      })
      if (key === 'welcome')
        fields.push({
          name: t('commands.ticket.usage.variables'),
          value: welcomeVariableHelp(t),
        })
    }
    fields.push(
      {
        name: t('commands.ticket.usage.examples'),
        value: t(`commands.ticket.usage.${key}.examples`, ctx.prefix),
      },
      {
        name: t('commands.ticket.usage.requirements'),
        value: [
          t('commands.ticket.usage.managerRequirement'),
          t(`commands.ticket.usage.${key}.requirements`),
        ]
          .filter(Boolean)
          .join('\n'),
      },
    )
  } else {
    fields.push(
      {
        name: t('commands.ticket.usage.commands'),
        value: t('commands.ticket.usage.groups'),
      },
      ...(
        [
          [
            'configuration',
            [
              'channel',
              'category',
              'staffrole',
              'logchannel',
              'namepattern',
              'blacklist',
              'config',
            ],
          ],
          ['panel', ['panel', 'option', 'welcome']],
          ['closing', ['close']],
          ['management', ['reopen', 'add', 'remove', 'transfer']],
        ] as const
      ).map(([group, keys]) => ({
        name: t(`commands.ticket.usage.sections.${group}`),
        value: keys
          .flatMap(usageLines)
          .map((line) => `- \`${line}\``)
          .join('\n'),
      })),
      {
        name: t('commands.ticket.usage.arguments'),
        value: t('commands.ticket.usage.argumentsDescription'),
        inline: true,
      },
      {
        name: t('commands.ticket.usage.requirements'),
        value: t('commands.ticket.usage.requirementsDescription'),
        inline: true,
      },
    )
  }
  await ctx.reply({
    embeds: [
      Embed({
        title: key
          ? t(`commands.ticket.usage.${key}.title`)
          : t('commands.ticket.usage.title'),
        description: key
          ? t(`commands.ticket.usage.${key}.description`)
          : t('commands.ticket.usage.description'),
        fields,
        color: colors.primary,
      }),
    ],
    allowedMentions: {
      parse: [],
      users: [ctx.author.id],
      roles: [],
      repliedUser: true,
    },
  })
}

export async function replyTicketUsageError(
  ctx: CommandContext,
  reason: string,
): Promise<void> {
  await ctx.reply({
    content: `${config.separator(emojis.error)} ${reason}`,
    allowedMentions: { parse: [] },
  })
}
