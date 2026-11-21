import { randomInt, randomUUID } from 'node:crypto'
import type { Client } from '@fluxerjs/core'
import { getRedis } from '@pudim/cache'
import {
  Giveaway,
  GiveawayParticipant,
  mongoose,
  type GiveawayRecord,
} from '@pudim/database'
import type { RestMessage } from '@pudim/shared/types'
import { colors, config, emojis } from '#bot/config'
import { i18n, type TranslateFunction } from '#bot/i18n'
import { Embed } from '#bot/utils'
import { emojiRoute } from '#bot/utils/emojis'
import { logger } from '#bot/utils/logger'
import { formatDuration } from '#bot/utils/time'
import { reactionManager } from '../reaction'
import { getUserTag, sendTemporaryMessage } from '../ticket/helpers'
import { apiCode, giveawayOperation, logGiveawayFailure } from './diagnostics'
import { validateRequirements, type Eligibility } from './eligibility'
import {
  channelPermissions,
  GiveawayError,
  giveawayNonce,
  httpStatus,
  messageLink,
  validateGiveawayEmoji,
} from './helpers'
import {
  deleteCreatedInvite,
  resolveRequiredServer,
  type CreateOptions,
} from './parse'
import { giveawayEmbed } from './view'

const LOCK_MS = 60_000
const REACTION_PREFIX = 'giveaway:join:'
const messageRoute = (giveaway: GiveawayRecord) =>
  `/channels/${giveaway.channelId}/messages/${giveaway.messageId}`
const translator = (giveaway: GiveawayRecord) =>
  i18n.getTranslator(i18n.resolveLocale(giveaway.locale))
type Lease = {
  giveaway: GiveawayRecord
  save: (
    set: Record<string, unknown>,
    extra?: Record<string, unknown>,
  ) => Promise<GiveawayRecord>
  assert: () => Promise<void>
}
type RecoveryMessage = RestMessage & {
  nonce?: string | null
  timestamp?: string
}

export class GiveawayManager {
  private readonly recentNotices = new Map<string, number>()
  private lastCacheFailureAt = 0
  async get(messageId: string, guildId?: string) {
    return Giveaway.findOne({
      messageId,
      ...(guildId ? { guildId } : {}),
    }).lean()
  }

  async participants(giveawayId: string) {
    return GiveawayParticipant.find({ giveawayId, entered: { $ne: false } })
      .select('userId')
      .lean()
  }

  async count(giveawayId: string) {
    return GiveawayParticipant.countDocuments({
      giveawayId,
      entered: { $ne: false },
    })
  }

  validateRequirements = validateRequirements

  private async withLock<T>(
    messageId: string,
    guildId: string | undefined,
    action: (lease: Lease) => Promise<T>,
  ): Promise<T> {
    const token = randomUUID()
    const query = { messageId, ...(guildId ? { guildId } : {}) }
    let giveaway = await giveawayOperation(
      {
        operationId: messageId.replace(/^pending:/, ''),
        operation: 'lease.acquire',
      },
      () =>
        Giveaway.findOneAndUpdate(
          {
            ...query,
            $or: [{ lockUntil: null }, { lockUntil: { $lte: new Date() } }],
          },
          {
            $set: {
              lockToken: token,
              lockUntil: new Date(Date.now() + LOCK_MS),
            },
          },
          { returnDocument: 'after' },
        ).lean(),
    )
    if (!giveaway)
      throw new GiveawayError(
        (await Giveaway.exists(query)) ? 'busy' : 'notFound',
      )
    const owned = () => ({
      _id: giveaway!._id,
      lockToken: token,
      lockUntil: { $gt: new Date() },
    })
    let lost = false
    const heartbeat = setInterval(() => {
      void Giveaway.updateOne(owned(), {
        $set: { lockUntil: new Date(Date.now() + LOCK_MS) },
      })
        .then((result) => {
          if (!result.matchedCount) lost = true
        })
        .catch((error) => {
          lost = true
          logGiveawayFailure(error, {
            operationId: String(giveaway!._id),
            operation: 'lease.renew',
          })
        })
    }, LOCK_MS / 3)
    heartbeat.unref?.()
    const lease: Lease = {
      giveaway,
      assert: async () => {
        if (
          lost ||
          !(await giveawayOperation(
            { operationId: String(giveaway!._id), operation: 'lease.verify' },
            () => Giveaway.exists(owned()),
          ))
        )
          throw new GiveawayError('busy')
      },
      save: async (set, extra = {}) => {
        if (lost) throw new GiveawayError('busy')
        const updated = await giveawayOperation(
          {
            operationId: String(giveaway!._id),
            operation: `record.save:${Object.keys(set).join(',')}`,
          },
          () =>
            Giveaway.findOneAndUpdate(
              owned(),
              { $set: set, ...extra },
              { returnDocument: 'after', runValidators: true },
            ).lean(),
        )
        if (!updated) throw new GiveawayError('busy')
        giveaway = updated
        lease.giveaway = updated
        return updated
      },
    }
    try {
      return await action(lease)
    } finally {
      clearInterval(heartbeat)
      await Giveaway.updateOne(
        { _id: giveaway._id, lockToken: token },
        { $set: { lockToken: null, lockUntil: null } },
      ).catch((error) =>
        logGiveawayFailure(error, {
          operationId: String(giveaway!._id),
          operation: 'lease.release',
        }),
      )
    }
  }

  async create(
    client: Client,
    input: CreateOptions,
    context: {
      guildId: string
      channelId: string
      creatorId: string
      locale: string
    },
  ) {
    const id = new mongoose.Types.ObjectId()
    const operationId = String(id)
    await giveawayOperation({ operationId, operation: 'indexes.ready' }, () =>
      Promise.all([Giveaway.init(), GiveawayParticipant.init()]),
    )
    const channelId = input.channelId ?? context.channelId
    if (
      !(await channelPermissions(
        client,
        context.guildId,
        channelId,
        [
          'ViewChannel',
          'SendMessages',
          'EmbedLinks',
          'AddReactions',
          'ReadMessageHistory',
        ],
        operationId,
      ))
    )
      throw new GiveawayError('channel')
    const emoji = await validateGiveawayEmoji(
      client,
      context.guildId,
      channelId,
      input.emoji,
      operationId,
    )
    const hostId = input.hostId ?? context.creatorId
    try {
      const user = (await giveawayOperation(
        {
          operationId,
          operation: 'host.resolve',
          method: 'GET',
          path: `/users/${hostId}`,
        },
        () => client.rest.get(`/users/${hostId}`),
      )) as {
        id?: string
      }
      if (user.id !== hostId) throw new GiveawayError('host')
    } catch (error) {
      throw new GiveawayError('host', { cause: error })
    }
    if (input.requiredRoleIds.length) {
      const path = `/guilds/${context.guildId}/roles`
      const roles = (await giveawayOperation(
        { operationId, operation: 'roles.resolve', method: 'GET', path },
        () => client.rest.get(path),
      )) as { id: string }[]
      if (
        input.requiredRoleIds.some(
          (id) => !roles.some((role) => role.id === id),
        )
      )
        throw new GiveawayError('roles')
    }
    const { duration, requiredServer, ...options } = input
    const provisional = {
      ...options,
      ...context,
      _id: id,
      hostId,
      channelId,
      emoji,
      messageId: `pending:${id}`,
      status: 'creating',
      endsAt: new Date(Date.now() + duration),
      durationMs: duration,
      createdAt: new Date(),
      endedAt: null,
      winners: [],
      history: [],
      revision: 0,
      requiredServerId: null,
      requiredServerInvite: null,
      requiredServerInput: requiredServer,
      serverResolved: !requiredServer,
    } as unknown as GiveawayRecord
    // Reserve room for the longest result/info suffix before publishing anything.
    giveawayEmbed(
      {
        ...provisional,
        messageId: '99999999999999999999',
        status: 'ended',
        endedAt: new Date(),
        winners: Array.from(
          { length: options.winnerCount },
          () => '99999999999999999999',
        ),
      },
      999999999,
      translator(provisional),
      true,
    )
    const doc = await giveawayOperation(
      { operationId, operation: 'record.prepare' },
      () => Giveaway.create(provisional),
    )
    try {
      await this.withLock(doc.messageId, context.guildId, (lease) =>
        this.publish(client, lease),
      )
    } catch (error) {
      logGiveawayFailure(error, { operationId, operation: 'creation' })
      if (error instanceof GiveawayError) throw error
      throw new GiveawayError(
        httpStatus(error) === 400
          ? 'apiRejected'
          : httpStatus(error) !== undefined &&
              httpStatus(error)! < 500 &&
              httpStatus(error) !== 429
            ? 'channel'
            : 'creationPending',
        { cause: error },
      )
    }
    const created = await Giveaway.findById(id).lean()
    if (created?.status === 'cancelled') throw new GiveawayError('channel')
    if (!created || created.status !== 'active')
      throw new GiveawayError('pending')
    return created
  }

  private async findSent(
    client: Client,
    channelId: string,
    nonce: string,
    since: Date,
    reference: string,
  ) {
    let before: string | undefined
    for (let page = 0; page < 100; page++) {
      const path = `/channels/${channelId}/messages?limit=100${before ? `&before=${before}` : ''}`
      const messages = (await giveawayOperation(
        {
          operationId: nonce,
          operation: 'delivery.history',
          method: 'GET',
          path,
        },
        () => client.rest.get(path),
      )) as RecoveryMessage[]
      if (!Array.isArray(messages)) throw new GiveawayError('pending')
      const found = messages.find(
        (message) =>
          message.author?.id === client.user?.id &&
          (String(message.nonce) === nonce ||
            message.content?.endsWith(`-# ${reference}`) ||
            message.embeds?.some(
              (embed) =>
                embed &&
                typeof embed === 'object' &&
                'footer' in embed &&
                (embed.footer as { text?: string } | null)?.text === reference,
            )),
      )
      if (found) return found.id
      if (
        messages.length < 100 ||
        messages.some(
          (message) =>
            message.timestamp &&
            Date.parse(message.timestamp) < since.getTime(),
        )
      )
        return null
      const next = messages.at(-1)?.id
      if (!next || next === before) throw new GiveawayError('pending')
      before = next
    }
    // Never resend when history cannot establish whether the previous send succeeded.
    throw new GiveawayError('pending')
  }

  private async publish(client: Client, lease: Lease) {
    try {
      await this.prepareServer(client, lease)
      const configured = lease.giveaway
      giveawayEmbed(
        {
          ...configured,
          status: 'ended',
          endedAt: new Date(),
          messageId: '99999999999999999999',
          winners: Array.from(
            { length: configured.winnerCount },
            () => '99999999999999999999',
          ),
        },
        999999999,
        translator(configured),
        true,
      )
      return await this.publishMessage(client, lease)
    } catch (error) {
      if (lease.giveaway.status === 'active')
        throw new GiveawayError('creationPending', { cause: error })
      const pending =
        error instanceof GiveawayError &&
        ['pending', 'creationPending', 'invitePending', 'busy'].includes(
          error.code,
        )
      if (
        lease.giveaway.status === 'creating' &&
        !pending &&
        ([400, 401, 403, 404].includes(httpStatus(error) ?? 0) ||
          error instanceof GiveawayError)
      ) {
        await (async () => {
          await lease.save({
            status: 'cancelled',
            endedAt: new Date(),
            needsUpdate: false,
            cleanupPending: true,
          })
          await this.cleanupCreation(client, lease)
        })().catch((failure) =>
          logGiveawayFailure(failure, {
            operationId: String(lease.giveaway._id),
            operation: 'creation.compensate',
          }),
        )
      }
      throw error
    }
  }

  private async prepareServer(client: Client, lease: Lease) {
    const giveaway = lease.giveaway
    if (giveaway.serverResolved || !giveaway.requiredServerInput) return
    if (giveaway.ownedInviteCode) {
      if (!giveaway.ownedInviteVerified)
        throw new GiveawayError('invitePermission')
      await lease.save({ serverResolved: true })
      return
    }
    if (giveaway.inviteCreationStartedAt)
      throw new GiveawayError('invitePending')
    const server = await resolveRequiredServer(
      client,
      giveaway.requiredServerInput,
      {
        operationId: String(giveaway._id),
        beforeCreate: async (channelId) => {
          await lease.save({
            inviteCreationStartedAt: new Date(),
            inviteChannelId: channelId,
          })
        },
        onRejected: async () => {
          await lease.save({ inviteCreationStartedAt: null })
        },
        onCreated: async (invite) => {
          await lease.save({
            ownedInviteCode: invite.code,
            ownedInviteVerified: invite.verified,
            requiredServerId: invite.requiredServerId,
            requiredServerInvite: invite.requiredServerInvite,
          })
        },
      },
    )
    await lease.save({ ...server, serverResolved: true })
  }

  private async cleanupCreation(client: Client, lease: Lease) {
    const giveaway = lease.giveaway
    if (giveaway.status !== 'cancelled' || !giveaway.cleanupPending) return
    const operationId = String(giveaway._id)
    if (!giveaway.messageId.startsWith('pending:')) {
      await reactionManager.unbind(client, giveaway.messageId, {
        clearReactions: false,
        strictPersistence: true,
      })
      try {
        await giveawayOperation(
          {
            operationId,
            operation: 'publication.delete',
            method: 'DELETE',
            path: messageRoute(giveaway),
          },
          () => client.rest.delete(messageRoute(giveaway)),
        )
      } catch (error) {
        if (httpStatus(error) !== 404 || apiCode(error) !== 'UNKNOWN_MESSAGE')
          throw error
      }
    }
    if (giveaway.ownedInviteCode)
      await deleteCreatedInvite(client, giveaway.ownedInviteCode, operationId)
    await lease.save({ cleanupPending: false, ownedInviteCode: null })
  }

  private async publishMessage(client: Client, lease: Lease) {
    let giveaway = lease.giveaway
    const nonce = giveawayNonce(String(giveaway._id), 'create')
    let messageId = !giveaway.messageId.startsWith('pending:')
      ? giveaway.messageId
      : null
    if (!messageId && giveaway.publicationStartedAt) {
      messageId = await this.findSent(
        client,
        giveaway.channelId,
        nonce,
        giveaway.publicationStartedAt,
        translator(giveaway)(
          'commands.giveaway.reference',
          String(giveaway._id),
        ),
      )
      if (
        !messageId &&
        Date.now() - giveaway.publicationStartedAt.getTime() < LOCK_MS
      )
        throw new GiveawayError('pending')
    }
    if (!messageId) {
      giveaway = await lease.save({
        publicationStartedAt: new Date(),
        ...(giveaway.durationMs
          ? { endsAt: new Date(Date.now() + giveaway.durationMs) }
          : {}),
      })
      await lease.assert()
      const path = `/channels/${giveaway.channelId}/messages`
      const body = {
        embeds: [giveawayEmbed(giveaway, 0, translator(giveaway)).toJSON()],
        nonce,
        allowed_mentions: { parse: [] },
      }
      const message = (await giveawayOperation(
        {
          operationId: String(giveaway._id),
          operation: 'publication.send',
          method: 'POST',
          path,
          request: body,
        },
        () => client.rest.post(path, { body }),
      )) as { id?: string; channel_id?: string; author?: { id?: string } }
      if (
        !message?.id ||
        !/^\d{17,20}$/.test(message.id) ||
        message.channel_id !== giveaway.channelId ||
        message.author?.id !== client.user?.id
      )
        throw new GiveawayError('creationPending')
      messageId = message.id
    }
    giveaway = await lease.save({ messageId })
    const reactionPath = `${messageRoute(giveaway)}/reactions/${emojiRoute(giveaway.emoji)}/@me`
    await giveawayOperation(
      {
        operationId: String(giveaway._id),
        operation: 'publication.react',
        method: 'PUT',
        path: reactionPath,
      },
      () => client.rest.put(reactionPath),
    )
    await this.bind(client, giveaway)
    giveaway = await lease.save({
      status: 'active',
      reactionReady: true,
      needsUpdate: true,
      lastReconciledAt: new Date(),
    })
    await this.updateMessage(client, lease)
    return giveaway
  }

  private async bind(client: Client, giveaway: GiveawayRecord) {
    await giveawayOperation(
      { operationId: String(giveaway._id), operation: 'reaction.bind' },
      () =>
        reactionManager.bind(
          { id: giveaway.messageId },
          {
            client,
            channelId: giveaway.channelId,
            guildId: giveaway.guildId,
            keys: [`${REACTION_PREFIX}${giveaway.emoji}`],
            permanent: true,
            strictPersistence: true,
          },
        ),
    )
  }

  private async notice(
    client: Client,
    giveaway: GiveawayRecord,
    userId: string,
    content: string,
    emoji: string = emojis.success,
  ) {
    const key = `giveaway:notice:${giveaway.messageId}:${userId}`
    const won = await Promise.resolve()
      .then(() => getRedis().send('SET', [key, '1', 'NX', 'EX', '5']))
      .catch((error) => {
        if (Date.now() - this.lastCacheFailureAt >= 60_000) {
          this.lastCacheFailureAt = Date.now()
          logGiveawayFailure(error, {
            operationId: String(giveaway._id),
            operation: 'feedback.cache',
          })
        }
        return 'unavailable'
      })
    if (won !== 'OK' && won !== 'unavailable') return
    const now = Date.now()
    if (now - (this.recentNotices.get(key) ?? 0) < 5000) return
    for (const [recentKey, at] of this.recentNotices)
      if (now - at >= 5000) this.recentNotices.delete(recentKey)
    this.recentNotices.set(key, now)
    await sendTemporaryMessage(
      client.rest,
      giveaway.channelId,
      {
        content: `${config.separator(emoji)} <@${userId}>, ${content}`,
        allowedMentions: { parse: [], users: [userId], roles: [] },
      },
      5000,
    )
  }

  private async notifyJoin(
    client: Client,
    giveaway: GiveawayRecord,
    userId: string,
  ) {
    const t = translator(giveaway)
    const link = messageLink(
      giveaway.guildId,
      giveaway.channelId,
      giveaway.messageId,
    )
    const end = Math.floor(
      (giveaway.endedAt ?? giveaway.endsAt).getTime() / 1000,
    )
    let sent = false
    try {
      const user = await client.users.fetch(userId)
      const hostTag = await getUserTag(client, giveaway.hostId)
      await user.send({
        embeds: [
          Embed({
            title: giveaway.title ?? t('commands.giveaway.title'),
            description: t(
              'commands.giveaway.dm.join',
              giveaway.title ?? '',
              end,
              hostTag,
              link,
            ),
            color: colors.success,
          }),
        ],
        allowedMentions: { parse: [] },
      })
      sent = true
    } catch (error) {
      logGiveawayFailure(error, {
        operationId: String(giveaway._id),
        operation: 'dm.join',
      })
    }
    if (!sent)
      await this.notice(
        client,
        giveaway,
        userId,
        t('commands.giveaway.fallback.join', giveaway.title ?? ''),
        emojis.success,
      )
  }

  private async notifyLeave(
    client: Client,
    giveaway: GiveawayRecord,
    userId: string,
  ) {
    const t = translator(giveaway)
    const link = messageLink(
      giveaway.guildId,
      giveaway.channelId,
      giveaway.messageId,
    )
    const end = Math.floor(
      (giveaway.endedAt ?? giveaway.endsAt).getTime() / 1000,
    )
    let sent = false
    try {
      const user = await client.users.fetch(userId)
      const hostTag = await getUserTag(client, giveaway.hostId)
      await user.send({
        embeds: [
          Embed({
            title: giveaway.title ?? t('commands.giveaway.title'),
            description: t(
              'commands.giveaway.dm.leave',
              giveaway.title ?? '',
              end,
              hostTag,
              link,
            ),
            color: colors.danger,
          }),
        ],
        allowedMentions: { parse: [] },
      })
      sent = true
    } catch (error) {
      logGiveawayFailure(error, {
        operationId: String(giveaway._id),
        operation: 'dm.leave',
      })
    }
    if (!sent)
      await this.notice(
        client,
        giveaway,
        userId,
        t('commands.giveaway.fallback.leave', giveaway.title ?? ''),
        emojis.success,
      )
  }

  private failureText(
    giveaway: GiveawayRecord,
    eligibility: Extract<Eligibility, { eligible: false }>,
    t: TranslateFunction,
  ) {
    switch (eligibility.reason) {
      case 'roles':
        return t(
          'commands.giveaway.feedback.roles',
          (eligibility.roles ?? []).map((id) => `<@&${id}>`).join(', '),
        )
      case 'joined':
        return t(
          'commands.giveaway.feedback.joined',
          formatDuration(giveaway.requiredJoinedDuration ?? 0, t),
        )
      case 'account':
        return t(
          'commands.giveaway.feedback.account',
          formatDuration(giveaway.requiredAccountAgeDuration ?? 0, t),
        )
      case 'server':
        return t(
          'commands.giveaway.feedback.server',
          giveaway.requiredServerInvite ?? giveaway.requiredServerId ?? '',
        )
      case 'member':
        return t('commands.giveaway.feedback.member')
      default:
        return t('commands.giveaway.feedback.pending')
    }
  }

  async addParticipant(client: Client, messageId: string, userId: string) {
    await this.recordReaction(client, messageId, userId, 'add')
  }

  async removeParticipant(client: Client, messageId: string, userId: string) {
    await this.recordReaction(client, messageId, userId, 'remove')
  }

  private async recordReaction(
    client: Client,
    messageId: string,
    userId: string,
    action: 'add' | 'remove',
  ) {
    if (userId === client.user?.id) return
    const giveaway = await this.get(messageId)
    if (
      !giveaway ||
      giveaway.status !== 'active' ||
      giveaway.endsAt.getTime() <= Date.now()
    )
      return
    await GiveawayParticipant.init()
    // The intent survives a busy worker or restart; only validated entries count.
    const filter = { giveawayId: messageId, userId }
    const update = {
      $set: { pendingAction: action, pendingAt: new Date() },
      $setOnInsert: { entered: false },
      $inc: { generation: 1 },
    }
    try {
      await GiveawayParticipant.updateOne(filter, update, { upsert: true })
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 11000
      )
        throw error
      await GiveawayParticipant.updateOne(filter, update)
    }
    try {
      await this.withLock(messageId, undefined, async (lease) => {
        if (lease.giveaway.status === 'active')
          await this.processPending(client, lease)
      })
    } catch (error) {
      if (!(error instanceof GiveawayError) || error.code !== 'busy')
        throw error
    }
  }

  private async processPending(client: Client, lease: Lease) {
    const giveaway = lease.giveaway
    const cutoff = giveaway.entriesClosedAt ?? giveaway.endsAt
    const pending = GiveawayParticipant.find({
      giveawayId: giveaway.messageId,
      pendingAction: { $in: ['add', 'remove'] },
    })
      .lean()
      .cursor()
    for await (const entry of pending) {
      const filter = {
        _id: entry._id,
        generation: entry.generation,
        pendingAction: entry.pendingAction,
        pendingAt: entry.pendingAt,
      }
      if (!entry.pendingAt || entry.pendingAt.getTime() > cutoff.getTime()) {
        await GiveawayParticipant.updateOne(filter, {
          $set: { pendingAction: null },
        })
        continue
      }
      await lease.assert()
      if (entry.pendingAction === 'remove') {
        const wasParticipating = !!entry.entered
        await lease.save({ needsUpdate: true })
        await GiveawayParticipant.updateOne(filter, {
          $set: { entered: false, pendingAction: null },
        })
        if (wasParticipating)
          await this.notifyLeave(client, giveaway, entry.userId)
        continue
      }
      const eligibility = await this.validateRequirements(
        client,
        giveaway,
        entry.userId,
        entry.pendingAt.getTime(),
      )
      if (
        !eligibility.eligible &&
        eligibility.reason === 'pending' &&
        giveaway.status !== 'active'
      )
        throw new GiveawayError('pending')
      await lease.assert()
      await lease.save({ needsUpdate: true })
      const result = await GiveawayParticipant.updateOne(filter, {
        $set: { entered: eligibility.eligible, pendingAction: null },
      })
      if (!result.matchedCount) continue
      if (!eligibility.eligible) {
        if (eligibility.reason !== 'bot')
          await this.notice(
            client,
            giveaway,
            entry.userId,
            this.failureText(giveaway, eligibility, translator(giveaway)),
            emojis.error,
          )
        await client.rest
          .delete(
            `${messageRoute(giveaway)}/reactions/${emojiRoute(giveaway.emoji)}/${entry.userId}`,
          )
          .catch((error) =>
            logGiveawayFailure(error, {
              operationId: String(giveaway._id),
              operation: 'reaction.reject',
              method: 'DELETE',
              path: messageRoute(giveaway),
            }),
          )
      } else if (giveaway.status === 'active' && !entry.entered) {
        await this.notifyJoin(client, giveaway, entry.userId)
      }
    }
  }

  private async reconcileParticipants(
    client: Client,
    lease: Lease,
    acceptNew: boolean,
  ) {
    const giveaway = lease.giveaway
    let users: Awaited<ReturnType<typeof reactionManager.fetchUsers>>
    try {
      users = await giveawayOperation(
        {
          operationId: String(giveaway._id),
          operation: 'reaction.reconcile',
          method: 'GET',
          path: `${messageRoute(giveaway)}/reactions/${emojiRoute(giveaway.emoji)}`,
        },
        () =>
          reactionManager.fetchUsers(
            client,
            giveaway.channelId,
            giveaway.messageId,
            giveaway.emoji,
          ),
      )
    } catch (error) {
      if (
        httpStatus(error) === 404 &&
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'UNKNOWN_MESSAGE'
      ) {
        await lease.save({
          status: 'cancelled',
          endedAt: new Date(),
          needsUpdate: false,
        })
        await reactionManager.unbind(client, giveaway.messageId, {
          clearReactions: false,
        })
        return false
      }
      throw new GiveawayError('pending', { cause: error })
    }
    const ids = new Set(
      users
        .filter((user) => !user.bot && user.id !== client.user?.id)
        .map((user) => user.id!),
    )
    if (acceptNew && !users.some((user) => user.id === client.user?.id)) {
      await lease.assert()
      await client.rest.put(
        `${messageRoute(giveaway)}/reactions/${emojiRoute(giveaway.emoji)}/@me`,
      )
    }
    const stored = await GiveawayParticipant.find({
      giveawayId: giveaway.messageId,
    }).lean()
    const storedByUser = new Map(stored.map((entry) => [entry.userId, entry]))
    for (const participant of stored) {
      if (
        !ids.has(participant.userId) &&
        participant.entered !== false &&
        participant.pendingAction !== 'add'
      ) {
        await lease.assert()
        await lease.save({ needsUpdate: true })
        await GiveawayParticipant.updateOne(
          { _id: participant._id, generation: participant.generation ?? null },
          {
            $set: { entered: false },
          },
        )
      }
    }
    if (acceptNew)
      for (const userId of ids) {
        const existing = storedByUser.get(userId)
        if (existing && (existing.entered !== false || existing.pendingAction))
          continue
        await lease.assert()
        if (existing)
          await GiveawayParticipant.updateOne(
            {
              _id: existing._id,
              generation: existing.generation ?? null,
              pendingAction: null,
            },
            {
              $set: { pendingAction: 'add', pendingAt: new Date() },
              $inc: { generation: 1 },
            },
          )
        else
          await GiveawayParticipant.updateOne(
            { giveawayId: giveaway.messageId, userId },
            {
              $setOnInsert: {
                pendingAction: 'add',
                pendingAt: new Date(),
                entered: false,
                generation: 1,
              },
            },
            { upsert: true },
          )
      }
    await lease.save({ lastReconciledAt: new Date() })
    return true
  }

  async selectEligibleWinners(
    client: Client,
    giveaway: GiveawayRecord,
    participantIds: string[],
    previous: string[] = [],
  ) {
    const unique = [...new Set(participantIds)]
    const past = new Set(previous)
    const pools = [
      unique.filter((id) => !past.has(id)),
      unique.filter((id) => past.has(id)),
    ]
    const candidates: string[] = []
    const drawCandidate = async (): Promise<string | null> => {
      for (const pool of pools)
        while (pool.length) {
          const index = randomInt(pool.length)
          const candidate = pool[index]!
          const last = pool.pop()!
          if (index < pool.length) pool[index] = last
          const eligible = await this.validateRequirements(
            client,
            giveaway,
            candidate,
          )
          if (!eligible.eligible) {
            if (eligible.reason === 'pending')
              throw new GiveawayError('pending')
            continue
          }
          return candidate
        }
      return null
    }
    while (candidates.length < giveaway.winnerCount) {
      const candidate = await drawCandidate()
      if (!candidate) break
      candidates.push(candidate)
    }
    const winners: string[] = []
    while (winners.length < giveaway.winnerCount) {
      const candidate = candidates.shift() ?? (await drawCandidate())
      if (!candidate) break
      const confirmed = await this.validateRequirements(
        client,
        giveaway,
        candidate,
      )
      if (!confirmed.eligible) {
        if (confirmed.reason === 'pending') throw new GiveawayError('pending')
        continue
      }
      winners.push(candidate)
    }
    return winners
  }

  private async finish(client: Client, lease: Lease, reroll: boolean) {
    let giveaway = lease.giveaway
    await this.processPending(client, lease)
    if (!reroll && !(await this.reconcileParticipants(client, lease, false)))
      return lease.giveaway
    const participants = await this.participants(giveaway.messageId)
    const previous = reroll
      ? [
          ...new Set([
            ...giveaway.winners,
            ...(giveaway.history ?? []).flatMap((result) => result.winners),
          ]),
        ]
      : []
    const winners = await this.selectEligibleWinners(
      client,
      giveaway,
      participants.map((participant) => participant.userId),
      previous,
    )
    await lease.assert()
    giveaway = await lease.save(
      {
        status: 'ended',
        winners,
        endedAt: giveaway.endedAt ?? new Date(),
        announcementPending: true,
        announcementId: null,
        deliveryStartedAt: null,
        needsUpdate: true,
        revision: (giveaway.revision ?? 0) + 1,
      },
      { $push: { history: { winners, at: new Date(), reroll } } },
    )
    await reactionManager.unbind(client, giveaway.messageId, {
      clearReactions: false,
    })
    await this.deliver(client, lease).catch((error) =>
      logGiveawayFailure(error, {
        operationId: String(giveaway._id),
        operation: 'result.deliver',
      }),
    )
    if (!reroll && !giveaway.creatorNotifiedAt) {
      const t = translator(giveaway)
      const winnersText = giveaway.winners.length
        ? giveaway.winners.map((id) => `<@${id}>`).join(', ')
        : `${t('commands.giveaway.none')}.`
      const link = messageLink(
        giveaway.guildId,
        giveaway.channelId,
        giveaway.messageId,
      )
      try {
        const user = await client.users.fetch(giveaway.creatorId)
        await user.send({
          embeds: [
            Embed({
              title: t('commands.giveaway.creatorEnded.title'),
              description: t(
                'commands.giveaway.creatorEnded.description',
                giveaway.title ?? t('commands.giveaway.title'),
                winnersText,
                link,
              ),
              color: colors.primary,
            }),
          ],
          allowedMentions: { parse: [] },
        })
        await lease.save({ creatorNotifiedAt: new Date() })
      } catch (error) {
        logGiveawayFailure(error, {
          operationId: String(giveaway._id),
          operation: 'dm.creatorEnded',
        })
      }
    }
    return giveaway
  }

  async end(client: Client, guildId: string, messageId: string) {
    return this.withLock(messageId, guildId, async (lease) => {
      if (lease.giveaway.status !== 'active') throw new GiveawayError('active')
      await lease.save({
        status: 'ending',
        entriesClosedAt: new Date(
          Math.min(Date.now(), lease.giveaway.endsAt.getTime()),
        ),
        needsUpdate: true,
      })
      return this.finish(client, lease, false)
    })
  }

  async reroll(client: Client, guildId: string, messageId: string) {
    return this.withLock(messageId, guildId, async (lease) => {
      if (
        lease.giveaway.status !== 'ended' ||
        lease.giveaway.announcementPending
      )
        throw new GiveawayError('ended')
      if (!lease.giveaway.history?.length)
        await lease.save(
          {},
          {
            $push: {
              history: {
                winners: lease.giveaway.winners,
                at: lease.giveaway.endedAt ?? new Date(),
                reroll: false,
              },
            },
          },
        )
      await lease.save({ status: 'rerolling', needsUpdate: true })
      return this.finish(client, lease, true)
    })
  }

  async cancel(client: Client, guildId: string, messageId: string) {
    return this.withLock(messageId, guildId, async (lease) => {
      if (lease.giveaway.status !== 'active') throw new GiveawayError('active')
      const giveaway = await lease.save({
        status: 'cancelled',
        endedAt: new Date(),
        needsUpdate: true,
      })
      await reactionManager.unbind(client, messageId, { clearReactions: false })
      await this.updateMessage(client, lease).catch((error) =>
        logGiveawayFailure(error, {
          operationId: String(giveaway._id),
          operation: 'cancel.edit',
        }),
      )
      return giveaway
    })
  }

  private async updateMessage(client: Client, lease: Lease) {
    const giveaway = lease.giveaway
    const count = await this.count(giveaway.messageId)
    await lease.assert()
    try {
      const body = {
        embeds: [giveawayEmbed(giveaway, count, translator(giveaway)).toJSON()],
        allowed_mentions: { parse: [] },
      }
      await giveawayOperation(
        {
          operationId: String(giveaway._id),
          operation: 'publication.edit',
          method: 'PATCH',
          path: messageRoute(giveaway),
          request: body,
        },
        () => client.rest.patch(messageRoute(giveaway), { body }),
      )
      await lease.save({ needsUpdate: false })
    } catch (error) {
      if (httpStatus(error) === 404 && apiCode(error) === 'UNKNOWN_MESSAGE') {
        const active = giveaway.status === 'active'
        await lease.save({
          needsUpdate: false,
          ...(active ? { status: 'cancelled', endedAt: new Date() } : {}),
        })
        if (active)
          await reactionManager.unbind(client, giveaway.messageId, {
            clearReactions: false,
          })
        logger.warn(
          `[Giveaway] original message missing: ${giveaway.messageId}`,
        )
        return
      }
      throw error
    }
  }

  private async deliver(client: Client, lease: Lease) {
    let giveaway = lease.giveaway
    if (giveaway.needsUpdate) await this.updateMessage(client, lease)
    if (!giveaway.announcementPending) return
    const nonce = giveawayNonce(
      String(giveaway._id),
      'result',
      giveaway.revision,
    )
    const reference = translator(giveaway)(
      'commands.giveaway.resultReference',
      String(giveaway._id),
      giveaway.revision,
    )
    if (giveaway.deliveryStartedAt) {
      const found = await this.findSent(
        client,
        giveaway.channelId,
        nonce,
        giveaway.deliveryStartedAt,
        reference,
      )
      if (found) {
        await lease.save({ announcementId: found, announcementPending: false })
        return
      }
      if (Date.now() - giveaway.deliveryStartedAt.getTime() < LOCK_MS) return
    }
    giveaway = await lease.save({ deliveryStartedAt: new Date() })
    await lease.assert()
    const t = translator(giveaway)
    const title = giveaway.title ?? t('commands.giveaway.title')
    const winnerMentions = giveaway.winners.map((id) => `<@${id}>`)
    let content: string
    if (giveaway.winners.length === 0) {
      content = t('commands.giveaway.announcements.none')
    } else if (giveaway.winners.length === 1) {
      content = t(
        'commands.giveaway.announcements.one',
        giveaway.emoji,
        winnerMentions[0]!,
        title,
      )
    } else {
      content = t(
        'commands.giveaway.announcements.many',
        giveaway.emoji,
        title,
        winnerMentions.join(', '),
      )
    }
    const path = `/channels/${giveaway.channelId}/messages`
    const body = {
      content: `${content}`,
      nonce,
      message_reference: {
        message_id: giveaway.messageId,
        channel_id: giveaway.channelId,
        guild_id: giveaway.guildId,
      },
      allowed_mentions: { parse: [], users: giveaway.winners },
    }
    const message = (await giveawayOperation(
      {
        operationId: String(giveaway._id),
        operation: 'result.announce',
        method: 'POST',
        path,
        request: body,
      },
      () => client.rest.post(path, { body }),
    )) as { id?: string; channel_id?: string; author?: { id?: string } }
    if (
      !message?.id ||
      !/^\d{17,20}$/.test(message.id) ||
      message.channel_id !== giveaway.channelId ||
      message.author?.id !== client.user?.id
    )
      throw new GiveawayError('pending')
    await lease.save({ announcementId: message.id, announcementPending: false })
  }

  async finishExpired(client: Client) {
    const pendingIds = await GiveawayParticipant.distinct('giveawayId', {
      pendingAction: { $in: ['add', 'remove'] },
    })
    const cursor = Giveaway.find({
      $and: [{ $or: [{ retryAt: null }, { retryAt: { $lte: new Date() } }] }],
      $or: [
        { status: 'active', endsAt: { $lte: new Date() } },
        { status: { $in: ['creating', 'ending', 'rerolling'] } },
        { needsUpdate: true },
        { announcementPending: true },
        { cleanupPending: true },
        { status: 'active', reactionReady: { $ne: true } },
        { status: 'active', messageId: { $in: pendingIds } },
        {
          status: 'active',
          $or: [
            { lastReconciledAt: null },
            { lastReconciledAt: { $lte: new Date(Date.now() - 60_000) } },
          ],
        },
      ],
    })
      .select('messageId guildId')
      .lean()
      .cursor()
    for await (const entry of cursor) {
      try {
        await this.withLock(entry.messageId, entry.guildId, async (lease) => {
          const giveaway = lease.giveaway
          if (giveaway.cleanupPending) {
            await this.cleanupCreation(client, lease)
            return
          }
          if (giveaway.status === 'creating') {
            await this.publish(client, lease)
            return
          }
          if (
            giveaway.status === 'active' &&
            giveaway.endsAt.getTime() <= Date.now()
          ) {
            await lease.save({
              status: 'ending',
              entriesClosedAt: giveaway.endsAt,
              needsUpdate: true,
            })
            await this.finish(client, lease, false)
          } else if (
            giveaway.status === 'ending' ||
            giveaway.status === 'rerolling'
          ) {
            await this.finish(client, lease, giveaway.status === 'rerolling')
          } else {
            if (
              giveaway.status === 'active' &&
              (!giveaway.lastReconciledAt ||
                giveaway.lastReconciledAt.getTime() <= Date.now() - 60_000)
            ) {
              if (!(await this.reconcileParticipants(client, lease, true)))
                return
            }
            if (giveaway.status === 'active')
              await this.processPending(client, lease)
            if (giveaway.status === 'active' && !giveaway.reactionReady) {
              await this.bind(client, giveaway)
              await lease.save({ reactionReady: true })
            }
            await this.deliver(client, lease)
          }
          await lease.save({ retryAt: null })
        })
      } catch (error) {
        if (error instanceof GiveawayError && error.code === 'busy') continue
        await Giveaway.updateOne(
          {
            _id: entry._id,
            $or: [{ lockUntil: null }, { lockUntil: { $lte: new Date() } }],
          },
          {
            $set: { retryAt: new Date(Date.now() + LOCK_MS) },
          },
        ).catch((failure) =>
          logGiveawayFailure(failure, {
            operationId: String(entry._id),
            operation: 'recovery.retry.save',
          }),
        )
        logGiveawayFailure(error, {
          operationId: String(entry._id),
          operation: 'recovery',
        })
      }
    }
  }
}

export const giveawayManager = new GiveawayManager()

reactionManager.registry({
  key: `${REACTION_PREFIX}*`,
  emoji: (key) => key.slice(REACTION_PREFIX.length),
  filter: reactionManager.filters.anyone,
  consume: false,
  ignoreOtherEmojis: true,
  concurrent: true,
  process: 'multiple',
  maxQueued: Infinity,
  cooldownMs: 0,
  run: (ctx) =>
    giveawayManager.addParticipant(ctx.client, ctx.messageId, ctx.clickerId),
  remove: (ctx) =>
    giveawayManager.removeParticipant(ctx.client, ctx.messageId, ctx.clickerId),
})
