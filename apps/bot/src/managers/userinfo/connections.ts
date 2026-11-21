import { safeText } from '#bot/utils'
import type { ConnectedAccount } from '#bot/utils/fluxer-profile'

const MAX_CONNECTIONS = 15

export function buildConnectionUrl(type: string, name: string): string | null {
  const value = name.trim()
  if (!value) return null

  try {
    let url: URL

    switch (type) {
      case 'domain': {
        if (
          value.includes('/') ||
          value.includes('@') ||
          value.includes('\\') ||
          value.includes('?') ||
          value.includes('#') ||
          value.includes(':') ||
          /\s/.test(value)
        ) {
          return null
        }

        url = new URL(`https://${value}`)
        if (
          !url.hostname.includes('.') ||
          url.hostname.startsWith('.') ||
          url.hostname.endsWith('.')
        ) {
          return null
        }
        break
      }

      case 'bsky': {
        if (!/^[a-zA-Z0-9._-]+$/.test(value) || value.length > 253) {
          return null
        }
        url = new URL(`https://bsky.app/profile/${encodeURIComponent(value)}`)
        break
      }

      default:
        return null
    }

    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export function formatPublicConnections(
  accounts: readonly ConnectedAccount[] | undefined,
): string[] {
  return (accounts ?? [])
    .filter((account) => ((account.visibility_flags ?? 0) & 1) !== 0)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .slice(0, MAX_CONNECTIONS)
    .map((account) => {
      const url = buildConnectionUrl(account.type, account.name)
      if (!url) return null
      return `[${safeText(account.name, 100)}](${url})`
    })
    .filter((value): value is string => value !== null)
}
