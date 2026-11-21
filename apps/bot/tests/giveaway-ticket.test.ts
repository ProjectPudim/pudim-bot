import type { Client } from '@fluxerjs/core'
import { describe, expect, spyOn, test } from 'bun:test'
import {
  Giveaway,
  GiveawayParticipant,
  Ticket,
  TicketConfig,
} from '@pudim/database'
import type { CommandContext } from '@pudim/framework'
import { colors } from '../src/config'
import ticketCommand from '../src/fluxer/commands/settings/ticket'
import giveawayCommand from '../src/fluxer/commands/utility/giveaway'
import readyEvent from '../src/fluxer/events/client/ready'
import { i18n } from '../src/i18n'
import { giveawayManager } from '../src/managers/giveaway'
import { GiveawayError } from '../src/managers/giveaway/helpers'
import { inviteCode, parseCreate } from '../src/managers/giveaway/parse'
import { giveawayHelp } from '../src/managers/giveaway/usage'
import type { ReactionContext } from '../src/managers/reaction'
import { resolveReaction } from '../src/managers/reaction/registry'
import { ScheduleManager, scheduleManager } from '../src/managers/schedule'
import { ticketActionManager } from '../src/managers/ticket'
import {
  renderTicketName,
  validateTicketNamePattern,
} from '../src/managers/ticket/helpers'
import { renderWelcomeEmbed } from '../src/managers/ticket/welcome'
import { registerGiveawayTasks } from '../src/tasks/giveaways'
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

describe('giveaway usage', () => {
  test('no arguments and unknown subcommand show safe help', async () => {
    for (const args of [[], ['unknown'], ['--help']]) {
      const { ctx, replies } = context(giveawayCommand, args)
      await giveawayCommand.run(ctx)
      expect(replies).toHaveLength(1)
      const embed = checkHelp(replies[0])
      const text = embed.fields!.map((field) => field.value).join('\n')
      expect(text).toContain('`giveaway create ')
      expect(text).toContain('`giveaway reroll ')
      expect(text).toContain('`giveaway cancel ')
      expect(text).toContain('--requiredServer')
      expect(text).toContain('--requiredAccountAge')
      expect(text).toContain('p.giveaway create')
    }
  })

  test('subcommand help remains scoped', async () => {
    for (const sub of ['create', 'reroll', 'cancel']) {
      const { ctx, replies } = context(giveawayCommand, [sub, '--help'])
      await giveawayCommand.run(ctx)
      const embed = checkHelp(replies[0])
      expect(embed.fields![0]!.value).toContain(`giveaway ${sub}`)
      expect(embed.fields![0]!.value.split('\n')).toHaveLength(1)
    }
    for (const sub of ['reroll', 'cancel']) {
      const { ctx, replies } = context(giveawayCommand, [sub])
      await giveawayCommand.run(ctx)
      checkHelp(replies[0])
    }
  })

  test('create without positional arguments shows create help', async () => {
    const { ctx, replies } = context(giveawayCommand, ['create'])
    await giveawayCommand.run(ctx)
    checkHelp(replies[0])
  })

  test('direct help has no foreign help-command translation keys', () => {
    const embed = giveawayHelp({ t, prefix: 'p.' }).toJSON()
    expect(JSON.stringify(embed)).not.toContain('commands.help')
  })
})

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
    expect(Giveaway.collection.name).toBe('giveaways')
    expect(GiveawayParticipant.collection.name).toBe('giveawayparticipants')
    expect(Ticket.collection.name).toBe('tickets')
    expect(TicketConfig.schema.indexes()).toContainEqual([
      { guildId: 1 },
      expect.objectContaining({ unique: true }),
    ])
    expect(GiveawayParticipant.schema.indexes()).toContainEqual([
      { giveawayId: 1, userId: 1 },
      expect.objectContaining({ unique: true }),
    ])
    expect(Ticket.schema.indexes()).toContainEqual([
      { guildId: 1, number: 1 },
      expect.objectContaining({ unique: true }),
    ])
  })

  test('create preserves requirements, emoji, flags and duration limits', () => {
    const result = parseCreate(
      [
        '2d',
        '2',
        'Um',
        'prêmio',
        '--requiredJoinedAt',
        '5d',
        '--requiredRoles',
        '<@&123456789012345678>',
        '--title',
        'Especial',
      ],
      t,
    )
    expect(result).toHaveProperty('data')
    if (!('data' in result)) throw new Error('Missing parsed options')
    expect(result.data).toMatchObject({
      duration: 172800000,
      winnerCount: 2,
      prize: 'Um prêmio',
      title: 'Especial',
      emoji: '🎉',
      requiredJoinedDuration: 432000000,
      requiredRoleIds: ['123456789012345678'],
    })
    expect(() => parseCreate(['30s', '1', 'Prêmio'], t)).toThrow(GiveawayError)
    expect(() => parseCreate(['1m', '21', 'Prêmio'], t)).toThrow(GiveawayError)
    expect(parseCreate(['--unknown', 'x'], t)).toHaveProperty('error')
    expect(parseCreate([], t)).toEqual({ missing: true })
  })

  test('required-server invite validation remains strict', () => {
    expect(inviteCode('https://fluxer.gg/valid')).toBe('valid')
    expect(inviteCode('https://fluxer.com/invite/valid')).toBe('valid')
    for (const value of [
      'http://fluxer.gg/valid',
      'https://other.test/valid',
      'https://fluxer.gg/valid?q=1',
      'https://user:pass@fluxer.gg/valid',
    ]) {
      expect(inviteCode(value)).toBeNull()
    }
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

describe('giveaway recovery scheduling', () => {
  test('ready registers one immediate 15-second task across repeated events', () => {
    const client = {} as Client
    const every = spyOn(scheduleManager, 'every')
    try {
      registerGiveawayTasks(client)
      registerGiveawayTasks(client)
      expect(every).toHaveBeenCalledTimes(1)
      expect(every.mock.calls[0]?.[0]).toBe(15000)
      expect(every.mock.calls[0]?.[2]).toMatchObject({
        id: 'giveaways:recover',
        immediate: true,
        unref: true,
      })
      expect(readyEvent.name).toBe('ready')
    } finally {
      scheduleManager.cancel('giveaways:recover')
      every.mockRestore()
    }
  })

  test('scheduler does not overlap long-running tasks', async () => {
    const scheduler = new ScheduleManager()
    let running = 0
    let peak = 0
    try {
      const id = scheduler.every(
        60000,
        async () => {
          running++
          peak = Math.max(peak, running)
          await Bun.sleep(10)
          running--
        },
        { unref: true },
      )
      await Promise.all([scheduler.runNow(id), scheduler.runNow(id)])
      expect(peak).toBe(1)
      expect(scheduler.get(id)?.runCount).toBe(1)
    } finally {
      scheduler.clear()
    }
  })
})

describe('reaction API compatibility', () => {
  test('giveaway keeps reactions and serializes add/remove per participant', async () => {
    const entry = resolveReaction('giveaway:join:🎉')
    expect(entry?.emoji).toBe('🎉')
    expect(entry?.def).toMatchObject({
      consume: false,
      ignoreOtherEmojis: true,
      concurrent: true,
      process: 'multiple',
      maxQueued: Infinity,
      cooldownMs: 0,
    })
    const ctx = {
      client: {},
      messageId: 'message',
      clickerId: 'user',
    } as unknown as ReactionContext
    const add = spyOn(giveawayManager, 'addParticipant').mockResolvedValue()
    const remove = spyOn(
      giveawayManager,
      'removeParticipant',
    ).mockResolvedValue()
    try {
      await entry!.def.run(ctx)
      await entry!.def.remove!(ctx)
      expect(add).toHaveBeenCalledWith(ctx.client, 'message', 'user')
      expect(remove).toHaveBeenCalledWith(ctx.client, 'message', 'user')
    } finally {
      add.mockRestore()
      remove.mockRestore()
    }
  })

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
