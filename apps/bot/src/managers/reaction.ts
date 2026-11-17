import type { Client, MessageReactionPayload, User } from '@fluxerjs/core'
import { cacheDel, cacheGet, cacheSet } from '@pudim/cache'
import { Reaction } from '@pudim/database'
import type { Rest, RestUser } from '@pudim/shared/types'
import {
  emojiIdentity as identity,
  emojiRoute as route,
} from '#bot/utils/emojis'
import { logger } from '#bot/utils/logger'

/** Default shape for a binding's state when a caller does not provide one. */
export type DefaultState = Record<string, unknown>

export type Clicker = { id: string; user: User | null }

export type AllowedMentionsPayload = {
  parse?: string[]
  users?: string[]
  roles?: string[]
  repliedUser?: boolean
}

export type EditPayload = {
  content?: string | null
  embeds?: unknown[]
  allowedMentions?: AllowedMentionsPayload
}

/** Gateway reaction event, as emitted by Fluxer. */
export type ReactionPayload = MessageReactionPayload

/** Serializable binding stored in Redis (and MongoDB when `permanent`). */
export type Binding<S extends object = DefaultState> = {
  messageId: string
  channelId: string
  guildId: string | null
  ownerId: string | null
  keys: string[]
  state: S
  permanent: boolean
  ttl: number
}

export interface ReactionContext<S extends object = DefaultState> {
  client: Client
  rest: Rest
  messageId: string
  channelId: string
  guildId: string | null
  ownerId: string | null
  clickerId: string
  key: string
  state: S
  live: unknown
  edit(payload: EditPayload): Promise<void>
  setKeys(keys: string[]): Promise<void>
  setState(patch: Partial<S>): void
  unbind(opts?: { clearReactions?: boolean }): Promise<void>
}

/**
 * `single`: ignora cliques enquanto já houver uma ação rodando.
 * `multiple`: enfileira todos os cliques e executa em ordem (FIFO).
 */
export type ReactionProcess = 'single' | 'multiple'

export interface ReactionDefinition<S extends object = DefaultState> {
  key: string
  emoji: string | ((key: string) => string)
  /**
   * Decide para quem a ação será executada. Quem não passar no filtro
   * tem a reação removida e nada mais acontece.
   */
  filter?: (
    ctx: ReactionContext<S>,
    clicker: Clicker,
  ) => boolean | Promise<boolean>
  run: (ctx: ReactionContext<S>) => unknown | Promise<unknown>
  remove?: (ctx: ReactionContext<S>) => unknown | Promise<unknown>
  ignoreOtherEmojis?: boolean
  maxQueued?: number
  consume?: boolean
  cooldownMs?: number
  concurrent?: boolean
  /** Padrão: `'single'`. */
  process?: ReactionProcess
}

export interface BindOptions<S extends object = DefaultState> {
  client: Client
  channelId: string
  guildId?: string | null
  ownerId?: string | null
  keys: string[]
  state?: S
  ttl?: number
  permanent?: boolean
  live?: unknown
  strictPersistence?: boolean
}

const DEFAULT_TTL_SEC = 10 * 60
const PERMANENT_CACHE_TTL_SEC = 60 * 60
const INDEX_REFRESH_MS = 5 * 60 * 1000
const DEFAULT_COOLDOWN_MS = 1000
const REACTION_PACE_MS = 320
const MAX_QUEUED = 10 // Queued clicks per lock in "multiple" mode

type Entry = {
  def: ReactionDefinition
  key: string
  emoji: string
  id: string
}
type Session = {
  live: unknown
  timer?: ReturnType<typeof setTimeout>
  client: Client
  channelId: string
}

const actions = new Map<string, ReactionDefinition>()
const wildcards = new Map<string, ReactionDefinition>()
const resolved = new Map<string, Entry>()
const sessions = new Map<string, Session>()
const busy = new Map<string, number>() // In-flight and queued actions per lock
const queues = new Map<string, Promise<void>>()
const recent = new Map<string, number>()

const permanentIds = new Set<string>()
let indexedAt = 0
let indexing: Promise<void> | null = null

const bindingKey = (messageId: string) => `reaction:${messageId}`
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const unique = <T>(list: T[]) => [...new Set(list)]

function resolve(key: string): Entry | null {
  const hit = resolved.get(key)
  if (hit) return hit

  let def = actions.get(key)
  if (!def) {
    for (const [prefix, candidate] of wildcards) {
      if (key.startsWith(prefix)) {
        def = candidate
        break
      }
    }
  }
  if (!def) return null

  const emoji = typeof def.emoji === 'function' ? def.emoji(key) : def.emoji
  const entry: Entry = { def, key, emoji, id: identity(emoji) }
  resolved.set(key, entry)
  return entry
}

const base = (channelId: string, messageId: string) =>
  `/channels/${channelId}/messages/${messageId}`

const addOwn = (
  rest: Rest,
  channelId: string,
  messageId: string,
  emoji: unknown,
) =>
  rest
    .put(`${base(channelId, messageId)}/reactions/${route(emoji)}/@me`)
    .then(() => true)
    .catch(() => false)

const dropOwn = (
  rest: Rest,
  channelId: string,
  messageId: string,
  emoji: unknown,
) =>
  rest
    .delete(`${base(channelId, messageId)}/reactions/${route(emoji)}/@me`)
    .then(() => true)
    .catch(() => false)

const dropUser = (
  rest: Rest,
  channelId: string,
  messageId: string,
  emoji: unknown,
  userId: string,
) =>
  rest
    .delete(`${base(channelId, messageId)}/reactions/${route(emoji)}/${userId}`)
    .then(() => true)
    .catch(() => false)

/** Serializes builder objects (anything exposing `toJSON`) into plain data. */
const plain = (value: unknown): unknown => {
  if (
    typeof value === 'object' &&
    value !== null &&
    'toJSON' in value &&
    typeof value.toJSON === 'function'
  ) {
    return (value.toJSON as () => unknown).call(value)
  }
  return value
}

function editBody(payload: EditPayload) {
  const body: Record<string, unknown> = {}
  if ('content' in payload) body.content = payload.content ?? null
  if (payload.embeds) body.embeds = payload.embeds.map(plain)
  if (payload.allowedMentions) {
    body.allowed_mentions = {
      parse: payload.allowedMentions.parse,
      users: payload.allowedMentions.users,
      roles: payload.allowedMentions.roles,
      replied_user: payload.allowedMentions.repliedUser,
    }
  }
  return body
}

async function addReactions(
  rest: Rest,
  channelId: string,
  messageId: string,
  keys: string[],
) {
  for (const key of keys) {
    const entry = resolve(key)
    if (!entry) continue
    await addOwn(rest, channelId, messageId, entry.emoji)
    await sleep(REACTION_PACE_MS)
  }
}

async function syncKeys(rest: Rest, binding: Binding, next: string[]) {
  const nextKeys = unique(next)
  for (const key of nextKeys) {
    if (!resolve(key))
      throw new Error(`ReactionManager: key "${key}" is not registered`)
  }

  const idsOf = (keys: string[]) =>
    new Set(
      keys.flatMap((k) => {
        const entry = resolve(k)
        return entry ? [entry.id] : []
      }),
    )

  const prevIds = idsOf(binding.keys)
  const nextIds = idsOf(nextKeys)
  const previous = binding.keys
  binding.keys = nextKeys

  for (const key of previous) {
    const entry = resolve(key)
    if (entry && !nextIds.has(entry.id)) {
      await dropOwn(rest, binding.channelId, binding.messageId, entry.emoji)
      await sleep(REACTION_PACE_MS)
    }
  }

  await addReactions(
    rest,
    binding.channelId,
    binding.messageId,
    nextKeys.filter((k) => !prevIds.has(resolve(k)!.id)),
  )
}

async function clearAll(
  rest: Rest,
  channelId: string,
  messageId: string,
  keys: string[],
) {
  const cleared = await rest
    .delete(`${base(channelId, messageId)}/reactions`)
    .then(() => true)
    .catch(() => false)
  if (cleared) return

  // Without permission to clear all, at least remove the bot's own reactions.
  for (const key of keys) {
    const entry = resolve(key)
    if (entry) await dropOwn(rest, channelId, messageId, entry.emoji)
  }
}

async function dbSave<S extends object = DefaultState>(
  binding: Binding<S>,
  strict = false,
) {
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

async function dbDelete(messageId: string, strict = false) {
  try {
    await Reaction.deleteOne({ messageId })
  } catch (err) {
    logger.error('ReactionManager: failed to delete from MongoDB', err)
    if (strict) throw err
  }
}

/** Returns `null` when missing and `undefined` when the read failed. */
async function dbFind(messageId: string): Promise<Binding | null | undefined> {
  try {
    const doc = await Reaction.findOne({ messageId }).lean()
    if (!doc) return null
    return {
      messageId: doc.messageId,
      channelId: doc.channelId,
      guildId: doc.guildId ?? null,
      ownerId: doc.ownerId ?? null,
      keys: doc.keys ?? [],
      state: doc.state ?? {},
      permanent: true,
      ttl: PERMANENT_CACHE_TTL_SEC,
    }
  } catch (err) {
    logger.error('ReactionManager: failed to read from MongoDB', err)
    return undefined
  }
}

function refreshIndex(): Promise<void> {
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

/** Redis first; permanent bindings are restored from MongoDB and cached again. */
async function load(messageId: string): Promise<Binding | null> {
  const cached = await cacheGet<Binding>(bindingKey(messageId))
  if (cached) return cached

  await refreshIndex()
  if (!permanentIds.has(messageId)) return null

  const stored = await dbFind(messageId)
  if (stored === undefined) return null
  if (stored === null) {
    permanentIds.delete(messageId)
    return null
  }

  await cacheSet(bindingKey(messageId), stored, stored.ttl)
  return stored
}

function schedule<S extends object = DefaultState>(
  messageId: string,
  binding: Binding<S>,
  session: Omit<Session, 'timer'>,
) {
  const previous = sessions.get(messageId)
  if (previous?.timer) clearTimeout(previous.timer)

  if (binding.permanent) {
    sessions.set(messageId, { ...session })
    return
  }

  const timer = setTimeout(async () => {
    sessions.delete(messageId)
    const stillThere = await cacheGet<Binding>(bindingKey(messageId))
    if (!stillThere)
      await clearAll(session.client.rest, session.channelId, messageId, [])
  }, binding.ttl * 1000)
  timer.unref?.()

  sessions.set(messageId, { ...session, timer })
}

function forget(messageId: string) {
  const session = sessions.get(messageId)
  if (session?.timer) clearTimeout(session.timer)
  sessions.delete(messageId)
}

const filters = {
  anyone: () => true,
  ownerOnly: <S extends object = DefaultState>(
    ctx: ReactionContext<S>,
    clicker: Clicker,
  ) => ctx.ownerId === null || clicker.id === ctx.ownerId,
}

function registry<S extends object = DefaultState>(def: ReactionDefinition<S>) {
  if (!def.key || !def.emoji)
    throw new Error('ReactionManager.registry: `key` and `emoji` are required')

  resolved.clear()

  // Definitions with different state types share one registry, so the state
  // type is erased here. Each definition still sees its own `S` in `run`.
  const stored = def as unknown as ReactionDefinition

  if (def.key.endsWith('*')) {
    if (typeof def.emoji !== 'function') {
      throw new Error(
        'ReactionManager.registry: wildcard keys require `emoji` to be a function',
      )
    }
    wildcards.set(def.key.slice(0, -1), stored)
    return
  }

  actions.set(def.key, stored)
}

async function bind<S extends object = DefaultState>(
  message: { id: string },
  opts: BindOptions<S>,
): Promise<Binding<S>> {
  const keys = unique(opts.keys)
  for (const key of keys) {
    if (!resolve(key))
      throw new Error(`ReactionManager.bind: key "${key}" is not registered`)
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

  // Persist before reacting so fast clicks are recognized.
  await Promise.all([
    cacheSet(bindingKey(binding.messageId), binding, binding.ttl),
    permanent ? dbSave(binding, opts.strictPersistence) : Promise.resolve(),
  ])
  if (permanent) permanentIds.add(binding.messageId)

  schedule(binding.messageId, binding, {
    live: opts.live,
    client: opts.client,
    channelId: binding.channelId,
  })

  await addReactions(
    opts.client.rest,
    binding.channelId,
    binding.messageId,
    keys,
  )
  return binding
}

async function unbind(
  client: Client,
  messageId: string,
  opts: { clearReactions?: boolean; strictPersistence?: boolean } = {},
) {
  const binding = await load(messageId)

  await cacheDel(bindingKey(messageId))
  if (binding?.permanent || opts.strictPersistence)
    await dbDelete(messageId, opts.strictPersistence)
  permanentIds.delete(messageId)
  forget(messageId)

  if (binding && opts.clearReactions !== false) {
    await clearAll(client.rest, binding.channelId, messageId, binding.keys)
  }
}

function get<S extends object = DefaultState>(
  messageId: string,
): Promise<Binding<S> | null> {
  return load(messageId) as Promise<Binding<S> | null>
}

async function edit<S extends object = DefaultState>(
  client: Client,
  messageId: string,
  fn: (draft: { keys: string[]; state: S }) => void | Promise<void>,
): Promise<Binding<S> | null> {
  const binding = await load(messageId)
  if (!binding) return null

  const draft = { keys: [...binding.keys], state: binding.state as S }
  await fn(draft)

  const keys = unique(draft.keys)
  if (!keys.length) {
    await unbind(client, messageId)
    return binding as Binding<S>
  }

  await syncKeys(client.rest, binding, keys)
  await cacheSet(bindingKey(messageId), binding, binding.ttl)
  if (binding.permanent) await dbSave(binding)

  return binding as Binding<S>
}

type Run = { ended: boolean }

/** Encadeia tarefas por lock, garantindo execução em ordem (FIFO). */
function enqueue(lockKey: string, task: () => Promise<void>): Promise<void> {
  const previous = queues.get(lockKey) ?? Promise.resolve()
  const result = previous.then(task)
  const tail = result.catch(() => {})
  queues.set(lockKey, tail)
  void tail.then(() => {
    if (queues.get(lockKey) === tail) queues.delete(lockKey)
  })
  return result
}

const findEntry = (binding: Binding, id: string) =>
  binding.keys.map((k) => resolve(k)).find((e) => e?.id === id) ?? null

function createContext(
  client: Client,
  binding: Binding,
  key: string,
  clickerId: string,
  fallbackGuildId: string | null,
  run: Run,
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
    live: sessions.get(messageId)?.live,
    async edit(body) {
      await rest.patch(base(channelId, messageId), { body: editBody(body) })
    },
    async setKeys(keys) {
      await syncKeys(rest, binding, keys)
    },
    setState(patch) {
      Object.assign(binding.state, patch)
    },
    async unbind(opts) {
      run.ended = true
      await unbind(client, messageId, opts)
    },
  }
}

type ActionInput = {
  messageId: string
  channelId: string
  userId: string
  emoji: unknown
  id: string
  guildHint: string | null
  removed?: boolean
}

/** Executa a ação de fato. Sempre recarrega o binding (importante na fila). */
async function runAction(client: Client, input: ActionInput) {
  const { messageId, channelId, userId, emoji, id, guildHint, removed } = input
  const rest: Rest = client.rest

  const binding = await load(messageId)
  if (!binding) return

  const entry = findEntry(binding, id)
  if (!entry) {
    if (
      !removed &&
      !binding.keys.some((key) => resolve(key)?.def.ignoreOtherEmojis)
    )
      await dropUser(rest, channelId, messageId, emoji, userId)
    return
  }

  const cooldownKey = `${messageId}:${userId}:${entry.key}`
  const cooldown = entry.def.cooldownMs ?? DEFAULT_COOLDOWN_MS
  if (!removed && Date.now() - (recent.get(cooldownKey) ?? 0) < cooldown) {
    await dropUser(rest, channelId, messageId, emoji, userId)
    return
  }

  recent.set(cooldownKey, Date.now())
  if (recent.size > 1000) {
    const limit = Date.now() - 60_000
    for (const [k, at] of recent) if (at < limit) recent.delete(k)
  }

  const run: Run = { ended: false }
  const snapshot = JSON.stringify({ keys: binding.keys, state: binding.state })
  const ctx = createContext(client, binding, entry.key, userId, guildHint, run)

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

      // Skip writes when nothing changed to avoid clobbering an in-flight edit
      if (changed || !entry.def.concurrent) {
        await cacheSet(bindingKey(messageId), binding, binding.ttl)
      }

      if (binding.permanent && changed) await dbSave(binding)

      const session = sessions.get(messageId)
      schedule(messageId, binding, {
        live: session?.live,
        client: session?.client ?? client,
        channelId,
      })
    }
  }
}

/** Returns `true` when the message is managed by this module. */
async function handle(
  client: Client,
  payload: ReactionPayload,
  removed = false,
): Promise<boolean> {
  const { user, emoji, userId, messageId, channelId, reaction } = payload
  if (!userId || !messageId || !channelId) return false

  const binding = await load(messageId)
  if (!binding) return false

  const rest: Rest = client.rest

  if (userId === client.user?.id || user?.bot === true) return true
  if (!user) {
    const fetched = await Promise.resolve(client.users?.fetch?.(userId)).catch(
      () => null,
    )
    if (fetched?.bot) return true
  }

  const id = identity(emoji)
  const entry = findEntry(binding, id)
  if (!entry) {
    if (
      !removed &&
      !binding.keys.some((key) => resolve(key)?.def.ignoreOtherEmojis)
    )
      await dropUser(rest, channelId, messageId, emoji, userId)
    return true
  }

  const def = entry.def
  if (removed && !def.remove) return true
  const guildHint = reaction?.guildId ?? null

  // 1) Filter first: failed reactions are removed and stop here
  let allowed = false
  try {
    const ctx = createContext(client, binding, entry.key, userId, guildHint, {
      ended: false,
    })
    allowed = await (def.filter ?? filters.ownerOnly)(ctx, {
      id: userId,
      user: user ?? null,
    })
  } catch (err) {
    logger.error(`ReactionManager: filter "${entry.key}" failed`, err)
  }

  if (!allowed) {
    await dropUser(rest, channelId, messageId, emoji, userId)
    return true
  }

  if (!removed && def.consume !== false) {
    await dropUser(rest, channelId, messageId, emoji, userId)
  }

  // 2) Single drops when busy; multiple queues up to MAX_QUEUED
  const mode: ReactionProcess = def.process ?? 'single'
  const lockKey = def.concurrent ? `${messageId}:${userId}` : messageId
  const depth = busy.get(lockKey) ?? 0

  if (mode === 'single' ? depth > 0 : depth >= (def.maxQueued ?? MAX_QUEUED)) {
    if (def.consume === false) {
      await dropUser(rest, channelId, messageId, emoji, userId)
    }
    return true
  }

  busy.set(lockKey, depth + 1)

  const task = () =>
    runAction(client, {
      messageId,
      channelId,
      userId,
      emoji,
      id,
      guildHint,
      removed,
    })

  try {
    if (mode === 'multiple') await enqueue(lockKey, task)
    else await task()
  } finally {
    const left = (busy.get(lockKey) ?? 1) - 1
    if (left <= 0) busy.delete(lockKey)
    else busy.set(lockKey, left)
  }

  return true
}

export class ReactionManager {
  readonly filters = filters

  async fetchUsers(
    client: Client,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<RestUser[]> {
    const users = new Map<string, RestUser>()
    let after: string | null = null
    for (let page = 0; page < 10_000; page++) {
      const response = (await client.rest.get(
        `${base(channelId, messageId)}/reactions/${route(emoji)}?limit=100${after ? `&after=${after}` : ''}`,
      )) as
        | RestUser[]
        | {
            items?: RestUser[]
            users?: RestUser[]
            has_more?: boolean
            next_after?: string | null
          }
      const batch = Array.isArray(response)
        ? response
        : (response.items ?? response.users)
      if (!Array.isArray(batch) || batch.some((user) => !user.id))
        throw new Error('ReactionManager: incomplete reaction users response')
      for (const user of batch) users.set(user.id!, user)
      const more = Array.isArray(response)
        ? batch.length === 100
        : response.has_more === true
      if (!more) return [...users.values()]
      const next = Array.isArray(response)
        ? batch.at(-1)?.id
        : response.next_after
      if (!next || next === after)
        throw new Error('ReactionManager: invalid reaction users cursor')
      after = next
    }
    throw new Error('ReactionManager: reaction users pagination limit exceeded')
  }

  registry<S extends object = DefaultState>(def: ReactionDefinition<S>): void {
    registry(def)
  }

  bind<S extends object = DefaultState>(
    message: { id: string },
    opts: BindOptions<S>,
  ): Promise<Binding<S>> {
    return bind(message, opts)
  }

  unbind(
    client: Client,
    messageId: string,
    opts: { clearReactions?: boolean; strictPersistence?: boolean } = {},
  ): Promise<void> {
    return unbind(client, messageId, opts)
  }

  get<S extends object = DefaultState>(
    messageId: string,
  ): Promise<Binding<S> | null> {
    return get<S>(messageId)
  }

  edit<S extends object = DefaultState>(
    client: Client,
    messageId: string,
    fn: (draft: { keys: string[]; state: S }) => void | Promise<void>,
  ): Promise<Binding<S> | null> {
    return edit<S>(client, messageId, fn)
  }

  async handler(
    payload: ReactionPayload,
    suppliedClient?: Client,
  ): Promise<boolean> {
    const client = suppliedClient ?? payload.reaction?.client
    if (!client) return false
    return handle(client, payload)
  }

  async removeHandler(
    payload: ReactionPayload,
    client?: Client,
  ): Promise<boolean> {
    const resolvedClient = client ?? payload.reaction?.client
    return resolvedClient ? handle(resolvedClient, payload, true) : false
  }
}

export const reactionManager = new ReactionManager()
