import type { RestUser } from './user'

export interface RestMember {
  user: RestUser
  nick: string | null
  avatar: string | null
  banner: string | null
  accent_color: number | null
  roles: string[]
  joined_at: string
  mute: boolean
  deaf: boolean
  communication_disabled_until: string | null
  profile_flags?: number
  mention_flags?: number
}
