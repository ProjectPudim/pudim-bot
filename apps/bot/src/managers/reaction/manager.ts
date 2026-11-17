import type { Client } from '@fluxerjs/core'
import type { Rest, RestUser } from '@pudim/shared/types'
import { emojiIdentity } from '#bot/utils/emojis'
import { logger } from '#bot/utils/logger'
import {
  checkAndRecordClickCooldown,
  DEFAULT_COOLDOWN_MS,
  MAX_QUEUED,
  runWithReactionLock,
} from './queue'
import { reactionFilters, registerReaction, resolveReaction } from './registry'
import {
  addReactionsByKeys,
  buildEditBody,
  clearAllReactions,
  dropUserReaction,
  fetchReactionUsers,
  messageRoute,
  syncReactionKeys,
  uniqueKeys,
} from './rest'
import {
  dbDeleteBinding,
  dbSaveBinding,
  DEFAULT_TTL_SEC,
  deleteCachedBinding,
  forgetSession,
  getSession,
  loadBinding,
  PERMANENT_CACHE_TTL_SEC,
  saveCachedBinding,
  scheduleSession,
  trackPermanentId,
  untrackPermanentId,
} from './store'
import type {
  Binding,
  BindOptions,
  DefaultState,
  ReactionContext,
  ReactionDefinition,
  ReactionPayload,
  ReactionProcess,
} from './types'

interface RunFlag {
  ended: boolean
}

const findBindingEntry = (binding: Binding, id: string) =>
  binding.keys.map((k) => resolveReaction(k)).find((e) => e?.id === id) ?? null

async function unbindMessage(
  client: Client,
  messageId: string,
  opts: { clearReactions?: boolean; strictPersistence?: boolean } = {},
): Promise<void> {
  const binding = await loadBinding(messageId)

  await deleteCachedBinding(messageId)
  if (binding?.permanent || opts.strictPersistence) {
    await dbDeleteBinding(messageId, opts.strictPersistence)
  }
  untrackPermanentId(messageId)
  forgetSession(messageId)

  if (binding && opts.clearReactions !== false) {
    await clearAllReactions(
      client.rest,
      binding.channelId,
      messageId,
      binding.keys,
    )
  }
}

function createReactionContext(
  client: Client,
  binding: Binding,
  key: string,
  clickerId: string,
  fallbackGuildId: string | null,
  run: RunFlag,
): ReactionContext {
  const rest: Rest = client.rest
  const { messageId, channelId } = binding

  return {
    client,
    rest,
    messageId,
    channelId,
    guildId: binding.guildId ?? fallbackGuildId,
    ownerId: binding.ownerId,
    clickerId,
    key,
    state: binding.state,
    live: getSession(messageId)?.live,
    async edit(body) {
      await rest.patch(messageRoute(channelId, messageId), {
        body: buildEditBody(body),
      })
    },
    async setKeys(keys) {
      await syncReactionKeys(rest, binding, keys)
    },
    setState(patch) {
      Object.assign(binding.state, patch)
    },
    async unbind(opts) {
      run.ended = true
      await unbindMessage(client, messageId, opts)
    },
  }
}

interface ActionInput {
  messageId: string
  channelId: string
  userId: string
  emoji: unknown
  id: string
  guildHint: string | null
  removed?: boolean
}

async function runReactionAction(
  client: Client,
  input: ActionInput,
): Promise<void> {
  const { messageId, channelId, userId, emoji, id, guildHint, removed } = input
  const rest: Rest = client.rest

  const binding = await loadBinding(messageId)
  if (!binding) return

  const entry = findBindingEntry(binding, id)
  if (!entry) {
    if (
      !removed &&
      !binding.keys.some((key) => resolveReaction(key)?.def.ignoreOtherEmojis)
    ) {
      await dropUserReaction(rest, channelId, messageId, emoji, userId)
    }
    return
  }

  if (
    !removed &&
    !checkAndRecordClickCooldown(
      `${messageId}:${userId}:${entry.key}`,
      entry.def.cooldownMs ?? DEFAULT_COOLDOWN_MS,
    )
  ) {
    await dropUserReaction(rest, channelId, messageId, emoji, userId)
    return
  }

  const run: RunFlag = { ended: false }
  const snapshot = JSON.stringify({ keys: binding.keys, state: binding.state })
  const ctx = createReactionContext(
    client,
    binding,
    entry.key,
    userId,
    guildHint,
    run,
  )

  try {
    if (removed) await entry.def.remove?.(ctx)
    else await entry.def.run(ctx)
  } catch (err) {
    logger.error(`ReactionManager: action "${entry.key}" failed`, err)
  } finally {
    if (!run.ended) {
      const changed =
        JSON.stringify({ keys: binding.keys, state: binding.state }) !==
        snapshot

      if (changed || !entry.def.concurrent) {
        await saveCachedBinding(binding)
      }
      if (binding.permanent && changed) await dbSaveBinding(binding)

      const session = getSession(messageId)
      scheduleSession(messageId, binding, {
        live: session?.live,
        client: session?.client ?? client,
        channelId,
      })
    }
  }
}

async function handleReactionPayload(
  client: Client,
  payload: ReactionPayload,
  removed = false,
): Promise<boolean> {
  const { user, emoji, userId, messageId, channelId, reaction } = payload
  if (!userId || !messageId || !channelId) return false

  const binding = await loadBinding(messageId)
  if (!binding) return false

  const rest: Rest = client.rest

  if (userId === client.user?.id || user?.bot === true) return true
  if (!user) {
    const fetched = await Promise.resolve(client.users?.fetch?.(userId)).catch(
      () => null,
    )
    if (fetched?.bot) return true
  }

  const id = emojiIdentity(emoji)
  const entry = findBindingEntry(binding, id)
  if (!entry) {
    if (
      !removed &&
      !binding.keys.some((key) => resolveReaction(key)?.def.ignoreOtherEmojis)
    ) {
      await dropUserReaction(rest, channelId, messageId, emoji, userId)
    }
    return true
  }

  const def = entry.def
  if (removed && !def.remove) return true
  const guildHint = reaction?.guildId ?? null

  let allowed = false
  try {
    const ctx = createReactionContext(
      client,
      binding,
      entry.key,
      userId,
      guildHint,
      { ended: false },
    )
    allowed = await (def.filter ?? reactionFilters.ownerOnly)(ctx, {
      id: userId,
      user: user ?? null,
    })
  } catch (err) {
    logger.error(`ReactionManager: filter "${entry.key}" failed`, err)
  }

  if (!allowed) {
    await dropUserReaction(rest, channelId, messageId, emoji, userId)
    return true
  }

  if (!removed && def.consume !== false) {
    await dropUserReaction(rest, channelId, messageId, emoji, userId)
  }

  const mode: ReactionProcess = def.process ?? 'single'
  const lockKey = def.concurrent ? `${messageId}:${userId}` : messageId

  const accepted = await runWithReactionLock(
    lockKey,
    mode,
    def.maxQueued ?? MAX_QUEUED,
    () =>
      runReactionAction(client, {
        messageId,
        channelId,
        userId,
        emoji,
        id,
        guildHint,
        removed,
      }),
  )

  if (!accepted && def.consume === false) {
    await dropUserReaction(rest, channelId, messageId, emoji, userId)
  }

  return true
}

export class ReactionManager {
  readonly filters = reactionFilters

  fetchUsers(
    client: Client,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<RestUser[]> {
    return fetchReactionUsers(client, channelId, messageId, emoji)
  }

  registry<S extends object = DefaultState>(def: ReactionDefinition<S>): void {
    registerReaction(def)
  }

  async bind<S extends object = DefaultState>(
    message: { id: string },
    opts: BindOptions<S>,
  ): Promise<Binding<S>> {
    const keys = uniqueKeys(opts.keys)
    for (const key of keys) {
      if (!resolveReaction(key)) {
        throw new Error(`ReactionManager.bind: key "${key}" is not registered`)
      }
    }

    const permanent = opts.permanent === true
    const binding: Binding<S> = {
      messageId: message.id,
      channelId: opts.channelId,
      guildId: opts.guildId ?? null,
      ownerId: opts.ownerId ?? null,
      keys,
      state: opts.state ?? ({} as S),
      permanent,
      ttl: permanent ? PERMANENT_CACHE_TTL_SEC : (opts.ttl ?? DEFAULT_TTL_SEC),
    }

    await Promise.all([
      saveCachedBinding(binding),
      permanent ? dbSaveBinding(binding, opts.strictPersistence) : undefined,
    ])
    if (permanent) trackPermanentId(binding.messageId)

    scheduleSession(binding.messageId, binding, {
      live: opts.live,
      client: opts.client,
      channelId: binding.channelId,
    })

    await addReactionsByKeys(
      opts.client.rest,
      binding.channelId,
      binding.messageId,
      keys,
    )
    return binding
  }

  unbind(
    client: Client,
    messageId: string,
    opts: { clearReactions?: boolean; strictPersistence?: boolean } = {},
  ): Promise<void> {
    return unbindMessage(client, messageId, opts)
  }

  get<S extends object = DefaultState>(
    messageId: string,
  ): Promise<Binding<S> | null> {
    return loadBinding(messageId) as Promise<Binding<S> | null>
  }

  async edit<S extends object = DefaultState>(
    client: Client,
    messageId: string,
    fn: (draft: { keys: string[]; state: S }) => void | Promise<void>,
  ): Promise<Binding<S> | null> {
    const binding = await loadBinding(messageId)
    if (!binding) return null

    const draft = { keys: [...binding.keys], state: binding.state as S }
    await fn(draft)

    const keys = uniqueKeys(draft.keys)
    if (!keys.length) {
      await unbindMessage(client, messageId)
      return binding as Binding<S>
    }

    await syncReactionKeys(client.rest, binding, keys)
    await saveCachedBinding(binding)
    if (binding.permanent) await dbSaveBinding(binding)

    return binding as Binding<S>
  }

  async handler(
    payload: ReactionPayload,
    suppliedClient?: Client,
  ): Promise<boolean> {
    const client = suppliedClient ?? payload.reaction?.client
    return client ? handleReactionPayload(client, payload, false) : false
  }

  async removeHandler(
    payload: ReactionPayload,
    suppliedClient?: Client,
  ): Promise<boolean> {
    const client = suppliedClient ?? payload.reaction?.client
    return client ? handleReactionPayload(client, payload, true) : false
  }
}

export const reactionManager = new ReactionManager()
