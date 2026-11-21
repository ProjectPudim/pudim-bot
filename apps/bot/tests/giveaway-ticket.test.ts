import { describe, expect, spyOn, test } from 'bun:test'
import { Ticket, TicketConfig } from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import { colors } from '../src/config'
import ticketCommand from '../src/fluxer/commands/settings/ticket'
import { i18n } from '../src/i18n'
import type { ReactionContext } from '../src/managers/reaction'
import { resolveReaction } from '../src/managers/reaction/registry'
import { ticketActionManager } from '../src/managers/ticket'
import {
  renderTicketName,
  validateTicketNamePattern,
} from '../src/managers/ticket/helpers'
import { renderWelcomeEmbed } from '../src/managers/ticket/welcome'
import type { EmbedJson } from '../src/utils/embed'

const t = i18n.getTranslator()
const authorId = '123456789012345678'

function context<C>(_command: { run: (ctx: C) => unknown }, args: string[]) {
  const replies: unknown[] = []
  const ctx = {
    args,
    guildId: '223456789012345678',
    author: { id: authorId },
    prefix: 'p.',
    t,
    async reply(payload: unknown) {
      replies.push(payload)
    },
  } as unknown as C & CommandContext
  return { ctx, replies }
}

type HelpReply = {
  embeds: {
    toJSON(): {
      title?: string
      description?: string
      color?: number
      fields?: { name: string; value: string; inline?: boolean }[]
    }
  }[]
  allowedMentions: unknown
}

function checkHelp(reply: unknown) {
  const payload = reply as HelpReply
  const embed = payload.embeds[0]!.toJSON()
  expect(payload.allowedMentions).toEqual({
    parse: [],
    users: [authorId],
    roles: [],
    repliedUser: true,
  })
  expect(embed.color).toBe(Number.parseInt(colors.primary.slice(1), 16))
  expect(embed.title).toBeTruthy()
  expect(embed.description).toContain('**')
  expect(embed.fields!.length).toBeLessThanOrEqual(25)
  for (const field of embed.fields!) {
    expect(field.name.length).toBeLessThanOrEqual(256)
    expect(field.value.length).toBeLessThanOrEqual(1024)
    expect(field.value).not.toContain('commands.')
  }
  const total =
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    embed.fields!.reduce(
      (sum, field) => sum + field.name.length + field.value.length,
      0,
    )
  expect(total).toBeLessThanOrEqual(6000)
  return embed
}

describe('ticket usage', () => {
  test('no arguments and unknown subcommands show general help', async () => {
    for (const args of [[], ['unknown']]) {
      const { ctx, replies } = context(ticketCommand, args)
      ctx.hasPermission = async () => true
      await ticketCommand.run(ctx)
      expect(replies).toHaveLength(1)
      const embed = checkHelp(replies[0])
      const text = embed.fields!.map((field) => field.value).join('\n')
      for (const sub of [
        'channel',
        'category',
        'staffrole',
        'logchannel',
        'namepattern',
        'blacklist',
        'config',
        'panel',
        'option',
        'welcome',
        'close',
        'reopen',
        'add',
        'remove',
        'transfer',
      ]) {
        expect(text).toContain(`ticket ${sub}`)
      }
    }
  })
})
describe('ported data and parsers', () => {
  test('ticket config defaults and counter are independent of Guild', () => {
    const doc = new TicketConfig({ guildId: '123' })
    expect(doc.guildId).toBe('123')
    expect(doc.counter).toBe(0)
    expect(doc.close).toMatchObject({
      action: 'archive',
      delay: 5,
      emoji: '❌',
      openerCanClose: true,
      dm: true,
    })
    expect(doc.namePattern).toBe('ticket-{ticket.count}')
    expect(doc.options).toEqual([])
    expect(doc.blacklist).toEqual([])
    expect(doc.staffRoleIds).toEqual([])
    expect(doc.panel?.embed).toBeNull()
    expect(doc.welcome?.embed).toBeNull()
  })
  test('legacy collection names and critical indexes are preserved', () => {
    expect(Ticket.collection.name).toBe('tickets')
    expect(TicketConfig.schema.indexes()).toContainEqual([
      { guildId: 1 },
      expect.objectContaining({ unique: true }),
    ])
    expect(Ticket.schema.indexes()).toContainEqual([
      { guildId: 1, number: 1 },
      expect.objectContaining({ unique: true }),
    ])
  })
  test('ticket name and welcome substitutions preserve stored templates', () => {
    expect(validateTicketNamePattern('{unknown}')).toMatchObject({
      ok: false,
      error: 'unknown',
    })
    expect(
      renderTicketName('ticket-{ticket.count}-{username}', {
        username: 'Miguel',
        userId: authorId,
        typeName: 'Suporte',
        typeEmoji: '🎫',
        count: 7,
        serverName: 'Pudim',
      }),
    ).toBe('ticket-007-Miguel')
    const stored: EmbedJson = {
      title: 'Olá {username}',
      description: '{user.mention} {ticket.number} {close.emoji}',
    }
    const rendered = renderWelcomeEmbed(stored, {
      username: 'Miguel',
      userId: authorId,
      ticketType: 'Suporte',
      ticketNumber: 7,
      channelId: '323456789012345678',
      serverName: 'Pudim',
      closeEmoji: '❌',
    })
    expect(rendered.description).toBe(`<@${authorId}> 007 ❌`)
    expect(stored.description).toBe(
      '{user.mention} {ticket.number} {close.emoji}',
    )
  })
})
describe('reaction API compatibility', () => {
  test('ticket panel and close emoji resolve through the existing wildcard registry', async () => {
    const openEntry = resolveReaction('ticket:open:🎫')
    const closeEntry = resolveReaction('ticket:close:❌')
    expect(openEntry?.emoji).toBe('🎫')
    expect(closeEntry?.emoji).toBe('❌')
    expect(openEntry?.def).toMatchObject({
      concurrent: true,
      process: 'single',
      cooldownMs: 3000,
    })
    expect(closeEntry?.def).toMatchObject({
      process: 'single',
      cooldownMs: 2000,
    })
    const ctx = {} as ReactionContext
    const open = spyOn(ticketActionManager, 'open').mockResolvedValue()
    const close = spyOn(
      ticketActionManager,
      'closeFromReaction',
    ).mockResolvedValue()
    try {
      await openEntry!.def.run(ctx)
      await closeEntry!.def.run(ctx)
      expect(open).toHaveBeenCalledWith(ctx)
      expect(close).toHaveBeenCalledWith(ctx)
    } finally {
      open.mockRestore()
      close.mockRestore()
    }
  })
})
