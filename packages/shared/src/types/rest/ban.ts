import type { RestUser } from './user'

export interface RestBan {
  user: RestUser
  reason: string | null
}
