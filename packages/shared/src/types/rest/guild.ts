import type { RestChannel } from './channel'
import type { RestRole } from './role'

export interface RestGuild {
  id: string
  name: string
  icon: string | null
  banner: string | null
  banner_width: number | null
  banner_height: number | null
  splash: string | null
  splash_width: number | null
  splash_height: number | null
  splash_card_alignment: number
  embed_splash: string | null
  embed_splash_width: number | null
  embed_splash_height: number | null
  vanity_url_code: string | null
  owner_id: string
  system_channel_id: string | null
  system_channel_flags: number
  rules_channel_id: string | null
  afk_channel_id: string | null
  afk_timeout: number
  features: string[]
  badge_ids: string[]
  verification_level: number
  mfa_level: number
  nsfw_level: number
  nsfw: boolean
  content_warning_level: number
  content_warning_text: string | null
  explicit_content_filter: number
  default_message_notifications: number
  disabled_operations: number
  message_history_cutoff: string | null

  permissions?: string
  roles?: RestRole[]
  emojis?: RestGuildEmoji[]
  stickers?: RestGuildSticker[]
  channels?: RestChannel[]
  member_count?: number
  online_count?: number
  approximate_member_count?: number
  approximate_presence_count?: number
  threads_active?: boolean
  visiting?: boolean
}

export type RestGuildEmoji = Record<string, unknown>
export type RestGuildSticker = Record<string, unknown>
