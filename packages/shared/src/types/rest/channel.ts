import type { RestUser } from './user'

export interface RestPermissionOverwrite {
  id: string
  type: number
  allow: string
  deny: string
}

export interface RestChannel {
  id: string
  type: number
  guild_id?: string
  name?: string
  topic?: string | null
  url?: string | null
  icon?: string | null
  owner_id?: string | null
  position?: number
  parent_id?: string | null
  bitrate?: number | null
  user_limit?: number | null
  voice_connection_limit?: number | null
  rtc_region?: string | null
  rtc_p2p?: boolean
  last_message_id?: string | null
  last_pin_timestamp?: string | null
  permission_overwrites?: RestPermissionOverwrite[]
  recipients?: RestUser[]
  nsfw?: boolean
  nsfw_override?: boolean | null
  content_warning_level?: number
  content_warning_text?: string | null
  rate_limit_per_user?: number
  nicks?: Record<string, string>
  flags?: number
  message_count?: number
  total_message_sent?: number
  member_count?: number
  applied_tags?: string[]
  member_ids_preview?: string[]
  default_auto_archive_duration?: number | null
  default_thread_rate_limit_per_user?: number
  default_sort_order?: number | null
  default_forum_layout?: number
  default_tag_setting?: string
}
