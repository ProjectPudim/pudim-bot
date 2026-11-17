import { emojiIdentity } from '#bot/utils/emojis'
import type {
  Clicker,
  DefaultState,
  ReactionContext,
  ReactionDefinition,
} from './types'

export interface ResolvedEntry {
  def: ReactionDefinition
  key: string
  emoji: string
  id: string
}

const actions = new Map<string, ReactionDefinition>()
const wildcards = new Map<string, ReactionDefinition>()
const resolved = new Map<string, ResolvedEntry>()

export const reactionFilters = {
  anyone: () => true,
  ownerOnly: <S extends object = DefaultState>(
    ctx: ReactionContext<S>,
    clicker: Clicker,
  ) => ctx.ownerId === null || clicker.id === ctx.ownerId,
}

export function registerReaction<S extends object = DefaultState>(
  def: ReactionDefinition<S>,
): void {
  if (!def.key || !def.emoji) {
    throw new Error('ReactionManager.registry: `key` and `emoji` are required')
  }

  resolved.clear()
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

export function resolveReaction(key: string): ResolvedEntry | null {
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
  const entry: ResolvedEntry = { def, key, emoji, id: emojiIdentity(emoji) }
  resolved.set(key, entry)
  return entry
}
