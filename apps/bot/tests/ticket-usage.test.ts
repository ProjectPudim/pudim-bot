import { describe, expect, spyOn, test } from 'bun:test'
import { Ticket, TicketConfig } from '@pudim/database'
import { colors, config, emojis } from '../src/config'
import ticketCommand from '../src/fluxer/commands/settings/ticket'
import { i18n } from '../src/i18n'
import {
  ticketActionManager,
  ticketOptionManager,
  ticketPanelManager,
} from '../src/managers/ticket'
import {
  TICKET_NAME_VARIABLE_ALIASES,
  TICKET_NAME_VARIABLE_LIST,
} from '../src/managers/ticket/helpers'
import {
  replyUsage,
  TICKET_SUBCOMMANDS,
  TICKET_USAGE,
  TICKET_USAGE_KEYS,
  type TicketUsageKey,
} from '../src/managers/ticket/usage'
import { TICKET_WELCOME_VARIABLES } from '../src/managers/ticket/welcome'
import type { Embed } from '../src/utils'

const t = i18n.getTranslator()
const authorId = '123456789012345678'
const channelId = '223456789012345678'
const guildId = '323456789012345678'
type Reply = {
  content?: string
  embeds?: (
    ReturnType<typeof Embed> | { title?: string; description?: string }
  )[]
  allowedMentions?: unknown
}

function context(args: string[]) {
  const replies: Reply[] = []
  const ctx = {
    args,
    guildId,
    channelId,
    author: { id: authorId, username: 'ana' },
    guild: { name: 'Servidor' },
    client: { rest: {}, user: null },
    prefix: 'teste.',
    t,
    hasPermission: async () => true,
    async reply(payload: Reply) {
      replies.push(payload)
    },
  } as unknown as Parameters<typeof ticketCommand.run>[0]
  return { ctx, replies }
}

function embedOf(reply: Reply) {
  const embed = reply.embeds?.[0]
  if (!embed || !('toJSON' in embed)) throw new Error('Expected a usage embed')
  return embed.toJSON()
}

function checkFocused(reply: Reply, key: TicketUsageKey) {
  expect(reply.content).toBeUndefined()
  const embed = embedOf(reply)
  expect(embed.title).toBe(t(`commands.ticket.usage.${key}.title`))
  expect(embed.description).toBe(t(`commands.ticket.usage.${key}.description`))
  expect(embed.color).toBe(Number.parseInt(colors.primary.slice(1), 16))
  expect(reply.allowedMentions).toEqual({
    parse: [],
    users: [authorId],
    roles: [],
    repliedUser: true,
  })
  expect(embed.fields?.[0]?.name).toBe('Como usar')
  expect(
    embed.fields?.find((field) => field.name === 'Exemplos')?.value,
  ).toContain('teste.ticket')
  expect(embed.fields!.length).toBeLessThanOrEqual(25)
  for (const field of embed.fields!) {
    expect(field.value.length).toBeLessThanOrEqual(1024)
    expect(field.name.length).toBeLessThanOrEqual(256)
  }
  expect(
    (embed.title?.length ?? 0) +
      (embed.description?.length ?? 0) +
      embed.fields!.reduce(
        (size, field) => size + field.name.length + field.value.length,
        0,
      ),
  ).toBeLessThanOrEqual(6000)
  expect(JSON.stringify(embed)).not.toContain('commands.ticket.')
  return embed
}

function checkError(reply: Reply, reason: string) {
  expect(reply.embeds).toBeUndefined()
  expect(reply.content).toContain(config.separator(emojis.error))
  expect(reply.content).toContain(reason)
  expect(reply.allowedMentions).toEqual({ parse: [] })
}

const missingCases: [string[], TicketUsageKey][] = [
  [['channel'], 'channel'],
  [['category'], 'category'],
  [['staffrole'], 'staffrole'],
  [['staffrole', 'add'], 'staffrole.add'],
  [['staffrole', 'remove'], 'staffrole.remove'],
  [['logchannel'], 'logchannel'],
  [['namepattern'], 'namepattern'],
  [['blacklist'], 'blacklist'],
  [['blacklist', 'add'], 'blacklist.add'],
  [['blacklist', 'remove'], 'blacklist.remove'],
  [['panel'], 'panel'],
  [['welcome'], 'welcome'],
  [['option'], 'option'],
  [['option', 'add'], 'option.add'],
  [['option', 'remove'], 'option.remove'],
  [['close', 'action'], 'close.action'],
  [['close', 'delay'], 'close.delay'],
  [['close', 'emoji'], 'close.emoji'],
  [['close', 'opener'], 'close.opener'],
  [['close', 'dm'], 'close.dm'],
  [['reopen'], 'reopen'],
  [['add'], 'add'],
  [['remove'], 'remove'],
  [['transfer'], 'transfer'],
]

const invalidCases: [string[], string][] = [
  [['channel', 'invalid'], t('commands.ticket.channel.notFound')],
  [['category', 'invalid', 'open'], t('commands.ticket.category.notCategory')],
  [
    ['category', `<#${channelId}>`],
    t('commands.ticket.usage.errors.missingCategoryTarget'),
  ],
  [
    ['category', `<#${channelId}>`, 'invalid'],
    t('commands.ticket.usage.errors.invalidCategoryTarget'),
  ],
  [
    ['staffrole', 'invalid'],
    t('commands.ticket.usage.errors.invalidStaffAction'),
  ],
  [['staffrole', 'add', 'invalid'], t('common.invalidRole')],
  [['staffrole', 'remove', 'invalid'], t('common.invalidRole')],
  [['logchannel', 'invalid'], t('commands.ticket.channel.notFound')],
  [['namepattern', '{invalid}'], 'Variável desconhecida'],
  [['namepattern', 'x'.repeat(101)], '100'],
  [['namepattern', ''], t('commands.ticket.usage.errors.emptyPattern')],
  [
    ['blacklist', 'invalid'],
    t('commands.ticket.usage.errors.invalidBlacklistAction'),
  ],
  [['blacklist', 'add', 'invalid'], t('common.invalid.messages.user')],
  [['blacklist', 'remove', 'invalid'], t('common.invalid.messages.user')],
  [['panel', '--color', 'invalid'], 'cor é inválida'],
  [['panel', 'invalid'], 'texto fora'],
  [['panel', '--help'], 'Argumento desconhecido'],
  [['welcome', '--color', 'invalid'], 'cor é inválida'],
  [['welcome', '--timestamp'], 'não permite'],
  [
    ['option', 'invalid'],
    t('commands.ticket.usage.errors.invalidOptionAction'),
  ],
  [
    ['option', 'add', 'invalid', 'Nome'],
    t('commands.ticket.option.invalidEmoji'),
  ],
  [
    ['option', 'add', '🎫'],
    t('commands.ticket.usage.errors.missingOptionName'),
  ],
  [
    ['option', 'add', '🎫', 'x'.repeat(41)],
    t('commands.ticket.option.nameTooLong', 40),
  ],
  [['option', 'remove', 'invalid'], t('commands.ticket.option.invalidEmoji')],
  [
    ['close', 'action', 'invalid'],
    t('commands.ticket.usage.errors.invalidCloseAction'),
  ],
  [
    ['close', 'delay', '-1'],
    t('commands.ticket.usage.errors.invalidCloseDelay'),
  ],
  [
    ['close', 'delay', '31'],
    t('commands.ticket.usage.errors.invalidCloseDelay'),
  ],
  [['close', 'emoji', 'invalid'], t('commands.ticket.option.invalidEmoji')],
  [
    ['close', 'opener', 'invalid'],
    t('commands.ticket.usage.errors.invalidToggle'),
  ],
  [['close', 'dm', 'invalid'], t('commands.ticket.usage.errors.invalidToggle')],
  [
    ['reopen', 'invalid'],
    t('commands.ticket.usage.errors.invalidTicketReference'),
  ],
  [
    ['config', 'extra'],
    t('commands.ticket.usage.errors.unexpectedArguments', 'ticket config'),
  ],
  [
    ['option', 'list', 'extra'],
    t('commands.ticket.usage.errors.unexpectedArguments', 'ticket option list'),
  ],
  [
    ['panel', 'preview', 'extra'],
    t(
      'commands.ticket.usage.errors.unexpectedArguments',
      'ticket panel preview',
    ),
  ],
  [
    ['panel', 'send', 'extra'],
    t('commands.ticket.usage.errors.unexpectedArguments', 'ticket panel send'),
  ],
  [
    ['panel', 'update', 'extra'],
    t(
      'commands.ticket.usage.errors.unexpectedArguments',
      'ticket panel update',
    ),
  ],
  [
    ['welcome', 'preview', 'extra'],
    t(
      'commands.ticket.usage.errors.unexpectedArguments',
      'ticket welcome preview',
    ),
  ],
]

describe('focused ticket usage', () => {
  for (const [args, key] of missingCases) {
    test(`ticket ${args.join(' ')} without required arguments`, async () => {
      const { ctx, replies } = context(args)
      await ticketCommand.run(ctx)
      expect(replies).toHaveLength(1)
      checkFocused(replies[0]!, key)
    })
  }

  for (const key of TICKET_USAGE_KEYS) {
    test(`metadata for ${key} stays within embed limits`, async () => {
      const { ctx, replies } = context([])
      await replyUsage(ctx, key)
      checkFocused(replies[0]!, key)
    })
  }

  test('name and welcome variables come from the validation/rendering sources', async () => {
    const name = context([])
    await replyUsage(name.ctx, 'namepattern')
    const nameText = JSON.stringify(embedOf(name.replies[0]!))
    expect(nameText).toContain(TICKET_NAME_VARIABLE_LIST)
    expect(nameText).toContain('`{user.id}`')
    expect(nameText).toContain('`{username}`')
    for (const alias of TICKET_NAME_VARIABLE_ALIASES)
      expect(nameText).toContain(`{${alias}}`)
    const welcome = context([])
    await replyUsage(welcome.ctx, 'welcome')
    const welcomeText = JSON.stringify(embedOf(welcome.replies[0]!))
    for (const variable of TICKET_WELCOME_VARIABLES)
      expect(welcomeText).toContain(variable.name)
  })

  test('general usage preserves its command lines and uses the same metadata', async () => {
    const { ctx, replies } = context([])
    await ticketCommand.run(ctx)
    const text = embedOf(replies[0]!)
      .fields!.map((field) => field.value)
      .join('\n')
    expect(TICKET_USAGE.split('\n')).toHaveLength(26)
    for (const line of TICKET_USAGE.split('\n'))
      expect(text).toContain(`\`${line.replace('{prefix}', '')}\``)
    expect(TICKET_SUBCOMMANDS['close.delay'].lines[0]).toBe(
      'ticket close delay <seconds>',
    )
  })
})

describe('invalid ticket arguments', () => {
  for (const [args, reason] of invalidCases) {
    test(`ticket ${args.join(' ')} returns a specific error without an embed`, async () => {
      const { ctx, replies } = context(args)
      await ticketCommand.run(ctx)
      expect(replies).toHaveLength(1)
      checkError(replies[0]!, reason)
    })
  }
})

describe('argument-free actions are preserved', () => {
  test('config and welcome preview still read configuration and render content', async () => {
    const findOne = spyOn(TicketConfig, 'findOne').mockReturnValue({
      lean: async () => null,
    } as unknown as ReturnType<typeof TicketConfig.findOne>)
    try {
      for (const args of [['config'], ['welcome', 'preview']]) {
        const { ctx, replies } = context(args)
        await ticketCommand.run(ctx)
        expect(replies).toHaveLength(1)
        const embed = replies[0]!.embeds![0]!
        expect('toJSON' in embed ? embed.toJSON().title : embed.title).toBe(
          args[0] === 'config'
            ? t('commands.ticket.config.title')
            : 'Ticket aberto',
        )
      }
      expect(findOne).toHaveBeenCalledTimes(2)
    } finally {
      findOne.mockRestore()
    }
  })

  test('option list and panel preview still execute their actions', async () => {
    const list = spyOn(ticketOptionManager, 'list').mockResolvedValue()
    const preview = spyOn(ticketPanelManager, 'preview').mockResolvedValue()
    try {
      await ticketCommand.run(context(['option', 'list']).ctx)
      await ticketCommand.run(context(['panel', 'preview']).ctx)
      expect(list).toHaveBeenCalledTimes(1)
      expect(preview).toHaveBeenCalledTimes(1)
    } finally {
      list.mockRestore()
      preview.mockRestore()
    }
  })

  test('close without arguments and with a reason still dispatches the close action', async () => {
    const close = spyOn(ticketActionManager, 'close').mockResolvedValue()
    try {
      for (const args of [
        ['close'],
        ['close', 'Resolvido'],
        ['close', '--help'],
      ]) {
        const { ctx, replies } = context(args)
        await ticketCommand.run(ctx)
        expect(replies).toHaveLength(0)
      }
      expect(close).toHaveBeenCalledTimes(3)
    } finally {
      close.mockRestore()
    }
  })

  test('close outside a ticket preserves the existing error', async () => {
    const findOne = spyOn(Ticket, 'findOne').mockReturnValue({
      lean: async () => null,
    } as unknown as ReturnType<typeof Ticket.findOne>)
    try {
      const { ctx, replies } = context(['close'])
      await ticketCommand.run(ctx)
      checkError(replies[0]!, t('commands.ticket.notTicketChannel.description'))
    } finally {
      findOne.mockRestore()
    }
  })

  for (const action of ['add', 'remove', 'transfer'] as const) {
    test(`${action} with an invalid user preserves channel and staff checks`, async () => {
      const findTicket = spyOn(Ticket, 'findOne').mockReturnValue({
        lean: async () => ({ guildId, channelId }),
      } as unknown as ReturnType<typeof Ticket.findOne>)
      const findConfig = spyOn(TicketConfig, 'findOne').mockReturnValue({
        lean: async () => ({ staffRoleIds: [] }),
      } as unknown as ReturnType<typeof TicketConfig.findOne>)
      try {
        const { ctx, replies } = context([action, 'invalid'])
        ctx.client.rest.get = async <T>(route: string): Promise<T> => {
          const result: unknown = route.endsWith('/roles')
            ? []
            : route.includes('/members/')
              ? { roles: [] }
              : { owner_id: authorId }
          return result as T
        }
        await ticketCommand.run(ctx)
        checkError(replies[0]!, t('common.invalid.messages.user'))
      } finally {
        findTicket.mockRestore()
        findConfig.mockRestore()
      }
    })
  }
})
