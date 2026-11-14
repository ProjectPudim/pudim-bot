import type { RestAttachment } from './attachment'
import type { RestChannel } from './channel'
import type { RestEmbed } from './embed'
import type { RestUser } from './user'

export interface RestEmoji {
  id?: string
  name: string
  animated?: boolean
}

export interface RestReaction {
  emoji: RestEmoji
  count: number
  me?: boolean
}

export interface RestMessageReference {
  channel_id: string
  message_id?: string
  guild_id?: string
  type: number
}

export interface RestChannelMention {
  id: string
  name: string
  type: number
}

export interface RestStickerItem {
  id: string
  name: string
  animated: boolean
}

export interface RestMessageCall {
  participants: string[]
  ended_timestamp: string | null
}

export interface RestMessageSnapshot {
  content?: string
  timestamp: string
  edited_timestamp?: string
  mentions?: string[]
  mention_roles?: string[]
  mention_channels?: RestChannelMention[]
  embeds?: RestEmbed[]
  attachments?: RestAttachment[]
  stickers?: RestStickerItem[]
  type: number
  flags: number
}

export interface RestMessage {
  id: string
  channel_id: string
  author: RestUser
  webhook_id?: string
  type: number
  flags: number
  content: string
  timestamp: string
  edited_timestamp: string | null
  pinned: boolean
  mention_everyone: boolean
  tts: boolean
  mentions: RestUser[]
  mention_roles: string[]
  mention_channels?: RestChannelMention[]
  users?: RestUser[]
  embeds: RestEmbed[]
  attachments: RestAttachment[]
  stickers: RestStickerItem[]
  reactions?: RestReaction[]
  message_reference?: RestMessageReference
  message_snapshots?: RestMessageSnapshot[]
  nonce?: string
  call?: RestMessageCall
  referenced_message?: RestMessage | null
  thread?: RestChannel
}
