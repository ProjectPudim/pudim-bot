import { env } from '#bot/env'
import { http } from '@pudim/shared/http'

export interface ConnectedAccount {
  type: string
  name: string
  verified?: boolean
  visibility_flags?: number
  sort_order?: number
}

export interface FluxerProfile {
  id?: string
  username?: string
  discriminator?: string
  global_name?: string | null
  bot?: boolean
  avatar?: string | null
  avatarUrl?: string | null
  avatar_color?: number | null
  flags?: number
  timezone_offset?: number | null
  profile_limited?: boolean
  badges?: { key: string }[]
  profile?: {
    bio?: string | null
    pronouns?: string | null
    banner?: string | null
    bannerUrl?: string | null
    banner_color?: number | null
    accent_color?: number | null
  } | null
  connected_accounts?: ConnectedAccount[]
}

const CACHE_TTL = 45_000
const NEGATIVE_TTL = 10_000
const CACHE_MAX_SIZE = 1_000

interface CacheEntry {
  data: FluxerProfile | null
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

const pending = new Map<string, Promise<FluxerProfile | null>>()

function getCached(userId: string): CacheEntry | undefined {
  const entry = cache.get(userId)

  if (!entry) return undefined

  if (Date.now() >= entry.expiresAt) {
    cache.delete(userId)
    return undefined
  }

  cache.delete(userId)
  cache.set(userId, entry)

  return entry
}

function setCached(
  userId: string,
  data: FluxerProfile | null,
  ttl: number,
): void {
  cache.delete(userId)

  while (cache.size >= CACHE_MAX_SIZE) {
    const oldest = cache.keys().next().value

    if (oldest === undefined) break

    cache.delete(oldest)
  }

  cache.set(userId, { data, expiresAt: Date.now() + ttl })
}

async function request(
  userId: string,
  apiUrl: string,
): Promise<FluxerProfile | null> {
  try {
    const res = await http.get<{ user?: FluxerProfile | null }>(
      `${apiUrl}/fluxer/${userId}`,
    )

    const user = res.data?.user ?? null

    setCached(userId, user, user ? CACHE_TTL : NEGATIVE_TTL)

    return user
  } catch {
    setCached(userId, null, NEGATIVE_TTL)

    return null
  }
}

export async function fetchFluxerProfile(
  userId: string,
): Promise<FluxerProfile | null> {
  const apiUrl = env.FELIPW_API_URL

  if (!apiUrl) return null

  const cached = getCached(userId)

  if (cached) return cached.data

  const inFlight = pending.get(userId)

  if (inFlight) return inFlight

  const promise = request(userId, apiUrl).finally(() => {
    pending.delete(userId)
  })

  pending.set(userId, promise)

  return promise
}