import crypto from 'node:crypto'
import type { Resolved } from './constants'
import type { BrowserProfile } from './types'

export async function detectChromeMajor(fallback: number): Promise<number> {
  try {
    const res = await fetch(
      'https://versionhistory.googleapis.com/v1/chrome/platforms/win/channels/stable/versions?pageSize=1&orderBy=version%20desc',
      { signal: AbortSignal.timeout(10_000) },
    )
    const json = (await res.json()) as {
      versions?: Array<{ version?: string }>
    }
    const major = parseInt(json.versions?.[0]?.version?.split('.')[0] ?? '', 10)
    if (Number.isInteger(major) && major >= 100 && major < 400) return major
  } catch {
    // Network down or API unavailable: continue with the fallback version
  }
  return fallback
}

export function buildProfiles(major: number): BrowserProfile[] {
  const ua = (platform: string) =>
    `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
  const secChUa = (brand: string) =>
    `"Not.A/Brand";v="8", "Chromium";v="${major}", "${brand}";v="${major}"`
  const win = 'Windows NT 10.0; Win64; x64'
  return [
    {
      name: `Chrome ${major} / Windows`,
      ua: ua(win),
      secChUa: secChUa('Google Chrome'),
      platform: 'Windows',
    },
    {
      name: `Chrome ${major} / macOS`,
      ua: ua('Macintosh; Intel Mac OS X 10_15_7'),
      secChUa: secChUa('Google Chrome'),
      platform: 'macOS',
    },
    {
      name: `Edge ${major} / Windows`,
      ua: `${ua(win)} Edg/${major}.0.0.0`,
      secChUa: secChUa('Microsoft Edge'),
      platform: 'Windows',
    },
  ]
}

export function pickProfile(
  profiles: BrowserProfile[],
  exclude: BrowserProfile | null = null,
): BrowserProfile {
  const pool = profiles.filter((p) => p !== exclude)
  const picked = pool[crypto.randomInt(Math.max(pool.length, 1))] ?? profiles[0]
  return (
    picked ?? {
      name: 'Fallback Chrome',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      secChUa:
        '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      platform: 'Windows',
    }
  )
}

export function browserHeaders(
  cfg: Resolved,
  url: URL,
  profile: BrowserProfile,
  siteOrigin: string,
): Headers {
  const headers = new Headers()
  const referer = cfg.referer === undefined ? `${siteOrigin}/` : cfg.referer
  const isImage = cfg.kind === 'image'

  headers.set('sec-ch-ua', profile.secChUa)
  headers.set('sec-ch-ua-mobile', '?0')
  headers.set('sec-ch-ua-platform', `"${profile.platform}"`)
  headers.set('User-Agent', cfg.userAgent ?? profile.ua)
  headers.set(
    'Accept',
    isImage
      ? 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      : 'application/json, text/plain, */*',
  )
  headers.set('Accept-Language', 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7')
  headers.set('Accept-Encoding', 'gzip, deflate, br')
  headers.set('Sec-Fetch-Mode', isImage ? 'no-cors' : 'cors')
  headers.set('Sec-Fetch-Dest', isImage ? 'image' : 'empty')

  if (referer) {
    headers.set('Referer', referer)
    headers.set('Sec-Fetch-Site', secFetchSite(url.hostname, referer))
  }
  return headers
}

function secFetchSite(targetHost: string, refererUrl: string): string {
  try {
    const origin = new URL(refererUrl).hostname
    if (targetHost === origin) return 'same-origin'
    const root = (host: string) => host.split('.').slice(-2).join('.')
    return root(targetHost) === root(origin) ? 'same-site' : 'cross-site'
  } catch {
    return 'cross-site'
  }
}
