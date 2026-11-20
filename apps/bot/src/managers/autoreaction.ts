import type { Message } from '@fluxerjs/core'
import { cacheDel, cacheGet, cacheSet } from '@pudim/cache'
import {
  AutoReaction,
  MAX_AUTO_REACTIONS,
  type AutoReactionType,
} from '@pudim/database'
import { parseEmoji } from '#bot/utils/emojis'
import { logger } from '#bot/utils/logger'

const VALID_TYPES = new Set<AutoReactionType>([
  'all',
  'text',
  'image',
  'video',
  'media',
  'link',
])
const VALID_IGNORES = new Set(['bots', 'replies', 'webhooks'])

export interface AutoReactionConfig {
  id: string
  guildId: string
  channelId: string
  reaction: string
  type: AutoReactionType
  ignore: string[]
}

export class AutoReactionManager {
  private cacheKey(guildId: string, channelId: string): string {
    return `autoreaction:${guildId}:${channelId}`
  }

  async getChannelConfig(
    guildId: string,
    channelId: string,
  ): Promise<AutoReactionConfig[]> {
    const key = this.cacheKey(guildId, channelId)
    try {
      const cached = await cacheGet<AutoReactionConfig[]>(key)
      if (cached) return cached
    } catch {
      // ignore cache errors
    }

    const docs = await AutoReaction.find({ guildId, channelId }).lean()
    const configs: AutoReactionConfig[] = docs.map((doc) => ({
      id: String(doc._id),
      guildId: doc.guildId,
      channelId: doc.channelId,
      reaction: doc.reaction,
      type: doc.type as AutoReactionType,
      ignore: doc.ignore ?? [],
    }))

    try {
      await cacheSet(key, configs, 300)
    } catch {
      // ignore cache errors
    }

    return configs
  }

  private invalidate(guildId: string, channelId: string): Promise<void> {
    return cacheDel(this.cacheKey(guildId, channelId)).catch(() => {})
  }

  normalizeReaction(input: string): string | null {
    const parsed = parseEmoji(input)
    if (!parsed) return null
    return parsed.raw
  }

  normalizeIgnore(input?: string): string[] | null {
    if (!input) return []
    const parts = input
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)

    const normalized: string[] = []
    for (const part of parts) {
      if (!VALID_IGNORES.has(part)) return null
      if (!normalized.includes(part)) normalized.push(part)
    }
    return normalized
  }

  validateType(type: string): AutoReactionType | null {
    const normalized = type.toLowerCase() as AutoReactionType
    return VALID_TYPES.has(normalized) ? normalized : null
  }

  async add(
    guildId: string,
    channelId: string,
    reaction: string,
    type: AutoReactionType,
    ignore: string[] = [],
  ): Promise<
    | { ok: true; config: AutoReactionConfig; count: number }
    | { ok: false; reason: 'duplicate' | 'limit' | 'error' }
  > {
    try {
      const existing = await AutoReaction.findOne({
        guildId,
        channelId,
        reaction,
        type,
      })
      if (existing) return { ok: false, reason: 'duplicate' }

      const count = await AutoReaction.countDocuments({ guildId })
      if (count >= MAX_AUTO_REACTIONS) return { ok: false, reason: 'limit' }

      const doc = await AutoReaction.create({
        guildId,
        channelId,
        reaction,
        type,
        ignore,
      })

      await this.invalidate(guildId, channelId)

      return {
        ok: true,
        config: {
          id: String(doc._id),
          guildId: doc.guildId,
          channelId: doc.channelId,
          reaction: doc.reaction,
          type: doc.type as AutoReactionType,
          ignore: doc.ignore ?? [],
        },
        count: count + 1,
      }
    } catch (error) {
      logger.error('[AutoReaction] add failed', error)
      return { ok: false, reason: 'error' }
    }
  }

  async remove(
    guildId: string,
    channelId: string,
    reaction: string,
  ): Promise<number> {
    try {
      const result = await AutoReaction.deleteMany({
        guildId,
        channelId,
        reaction,
      })
      await this.invalidate(guildId, channelId)
      return result.deletedCount ?? 0
    } catch (error) {
      logger.error('[AutoReaction] remove failed', error)
      return 0
    }
  }

  async list(
    guildId: string,
    channelId?: string,
  ): Promise<AutoReactionConfig[]> {
    try {
      const query: Record<string, string> = { guildId }
      if (channelId) query.channelId = channelId
      const docs = await AutoReaction.find(query).lean()
      return docs.map((doc) => ({
        id: String(doc._id),
        guildId: doc.guildId,
        channelId: doc.channelId,
        reaction: doc.reaction,
        type: doc.type as AutoReactionType,
        ignore: doc.ignore ?? [],
      }))
    } catch (error) {
      logger.error('[AutoReaction] list failed', error)
      return []
    }
  }

  async clear(guildId: string, channelId: string): Promise<number> {
    try {
      const result = await AutoReaction.deleteMany({ guildId, channelId })
      await this.invalidate(guildId, channelId)
      return result.deletedCount ?? 0
    } catch (error) {
      logger.error('[AutoReaction] clear failed', error)
      return 0
    }
  }

  private isIgnored(message: Message, ignore: string[]): boolean {
    if (ignore.includes('bots') && message.author?.bot) return true
    if (ignore.includes('replies') && message.messageReference) return true
    if (
      ignore.includes('webhooks') &&
      (message as { webhookId?: string }).webhookId
    )
      return true
    return false
  }

  private messageTypes(message: Message): Set<string> {
    const types = new Set<string>(['all'])
    const content = message.content?.trim() ?? ''
    if (content.length > 0) types.add('text')

    const attachments = (
      message as {
        attachments?: {
          values?: () => Iterable<{ contentType?: string | null }>
        }
      }
    ).attachments
    const files = attachments?.values ? [...attachments.values()] : []
    let hasImage = false
    let hasVideo = false
    for (const file of files) {
      const ct = file.contentType ?? ''
      if (ct.startsWith('image/')) hasImage = true
      if (ct.startsWith('video/')) hasVideo = true
    }
    if (hasImage) {
      types.add('image')
      types.add('media')
    }
    if (hasVideo) {
      types.add('video')
      types.add('media')
    }

    if (/(https?:\/\/[^\s]+)/i.test(content)) types.add('link')

    return types
  }

  async processMessage(message: Message): Promise<void> {
    try {
      if (!message.guildId || message.author?.id === message.client.user?.id)
        return

      const guildId = message.guildId
      const channelId = message.channelId
      const configs = await this.getChannelConfig(guildId, channelId)
      if (!configs.length) return

      const types = this.messageTypes(message)
      const eligibleReactions = new Set<string>()

      for (const config of configs) {
        if (!types.has(config.type)) continue
        if (this.isIgnored(message, config.ignore)) continue
        eligibleReactions.add(config.reaction)
      }

      for (const reaction of eligibleReactions) {
        try {
          await message.react(reaction)
        } catch (error) {
          logger.error('[AutoReaction] react failed', error)
        }
      }
    } catch (error) {
      logger.error('[AutoReaction] processMessage failed', error)
    }
  }
}

export const autoReactionManager = new AutoReactionManager()
