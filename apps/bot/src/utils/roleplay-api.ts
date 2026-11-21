import { http } from '@pudim/shared/http'
import { env } from '#bot/env'

export type RoleplayAction =
  | 'bonk'
  | 'feed'
  | 'hug'
  | 'kiss'
  | 'pat'
  | 'poke'
  | 'punch'
  | 'slap'
  | 'wave'
  | 'yeet'

export interface RoleplayMedia {
  anime_name: string
  url: string
  dimensions: {
    width: number
    height: number
  }
}

interface NekosBestApiResponse {
  results: RoleplayMedia[]
}

export async function fetchRoleplayMedia(
  action: RoleplayAction,
): Promise<RoleplayMedia | undefined> {
  const apiUrl = env.ROLEPLAY_API_URL
  if (!apiUrl) return undefined

  try {
    const response = await http.get<NekosBestApiResponse>(
      `${apiUrl.replace(/\/+$/, '')}/${action}`,
    )
    return response.data.results[0]
  } catch {
    return undefined
  }
}
