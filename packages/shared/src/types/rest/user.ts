export interface RestUser {
  id: string
  username: string
  discriminator: string
  global_name: string | null
  avatar: string | null
  avatar_color: number | null
  bot?: boolean
  system?: boolean
  flags: number
  mention_flags?: number
}
