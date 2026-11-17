import type { Client } from '@fluxerjs/core'
import { cacheDel, cacheGet, cacheSet } from '@pudim/cache'
import { Reaction } from '@pudim/database'
import { logger } from '#bot/utils/logger'
import { clearAllReactions } from './rest'
import type { Binding, DefaultState } from './types'

export const DEFAULT_TTL_SEC = 10 * 60
export const PERMANENT_CACHE_TTL_SEC = 60 * 60
const INDEX_REFRESH_MS = 5 * 60 * 1000

export interface ReactionSession {
  live: unknown
  timer?: ReturnType<typeof setTimeout>
  client: Client
  channelId: string
}

const sessions = new Map<string, ReactionSession>()
const permanentIds = new Set<string>()
let indexedAt = 0
let indexing: Promise<void> | null = null

export const bindingCacheKey = (messageId: string) => `reaction:${messageId}`

export async function dbSaveBinding<S extends object = DefaultState>(
  binding: Binding<S>,
  strict = false,
): Promise<void> {
  try {
    await Reaction.updateOne(
      { messageId: binding.messageId },
      {
        $set: {
          channelId: binding.channelId,
          guildId: binding.guildId,
          ownerId: binding.ownerId,
          keys: binding.keys,
          state: binding.state,
        },
      },
      { upsert: true },
    )
  } catch (err) {
    logger.error('ReactionManager: failed to save to MongoDB', err)
    if (strict) throw err
  }
}

export async function dbDeleteBinding(
  messageId: string,
  strict = false,
): Promise<void> {
  try {
    await Reaction.deleteOne({ messageId })
  } catch (err) {
    logger.error('ReactionManager: failed to delete from MongoDB', err)
    if (strict) throw err
  }
}

async function dbFindBinding(
  messageId: string,
): Promise<Binding | null | undefined> {
  try {
    const doc = await Reaction.findOne({ messageId }).lean()
    if (!doc) return null
    return {
      messageId: doc.messageId,
      channelId: doc.channelId,
      guildId: doc.guildId ?? null,
      ownerId: doc.ownerId ?? null,
      keys: doc.keys ?? [],
      state: (doc.state as DefaultState | undefined) ?? {},
      permanent: true,
      ttl: PERMANENT_CACHE_TTL_SEC,
    }
  } catch (err) {
    logger.error('ReactionManager: failed to read from MongoDB', err)
    return undefined
  }
}

function refreshPermanentIndex(): Promise<void> {
  if (Date.now() - indexedAt < INDEX_REFRESH_MS) return Promise.resolve()

  indexing ??= (async () => {
    try {
      const ids = (await Reaction.distinct('messageId')) as string[]
      for (const id of ids) permanentIds.add(id)
    } catch (err) {
      logger.error('ReactionManager: failed to index permanent menus', err)
    } finally {
      indexedAt = Date.now()
      indexing = null
    }
  })()

  return indexing
}

export async function loadBinding(messageId: string): Promise<Binding | null> {
  const cached = await cacheGet<Binding>(bindingCacheKey(messageId))
  if (cached) return cached

  await refreshPermanentIndex()
  if (!permanentIds.has(messageId)) return null

  const stored = await dbFindBinding(messageId)
  if (stored === undefined) return null
  if (stored === null) {
    permanentIds.delete(messageId)
    return null
  }

  await cacheSet(bindingCacheKey(messageId), stored, stored.ttl)
  return stored
}

export function trackPermanentId(messageId: string): void {
  permanentIds.add(messageId)
}

export function untrackPermanentId(messageId: string): void {
  permanentIds.delete(messageId)
}

export async function saveCachedBinding<S extends object = DefaultState>(
  binding: Binding<S>,
): Promise<void> {
  await cacheSet(bindingCacheKey(binding.messageId), binding, binding.ttl)
}

export async function deleteCachedBinding(messageId: string): Promise<void> {
  await cacheDel(bindingCacheKey(messageId))
}

export function getSession(messageId: string): ReactionSession | undefined {
  return sessions.get(messageId)
}

export function scheduleSession<S extends object = DefaultState>(
  messageId: string,
  binding: Binding<S>,
  session: Omit<ReactionSession, 'timer'>,
): void {
  const previous = sessions.get(messageId)
  if (previous?.timer) clearTimeout(previous.timer)

  if (binding.permanent) {
    sessions.set(messageId, { ...session })
    return
  }

  const timer = setTimeout(async () => {
    sessions.delete(messageId)
    const stillThere = await cacheGet<Binding>(bindingCacheKey(messageId))
    if (!stillThere) {
      await clearAllReactions(
        session.client.rest,
        session.channelId,
        messageId,
        [],
      )
    }
  }, binding.ttl * 1000)
  timer.unref?.()

  sessions.set(messageId, { ...session, timer })
}

export function forgetSession(messageId: string): void {
  const session = sessions.get(messageId)
  if (session?.timer) clearTimeout(session.timer)
  sessions.delete(messageId)
}
