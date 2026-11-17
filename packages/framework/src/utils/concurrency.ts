export type ConcurrencyScope = 'user' | 'guild' | 'channel' | 'global'

export interface ConcurrencyOptions {
  limit: number
  scope?: ConcurrencyScope
}

const counts = new Map<string, number>()

export function concurrencyKey(
  commandName: string,
  scope: ConcurrencyScope,
  identity: {
    userId?: string | null
    guildId?: string | null
    channelId?: string | null
  },
): string {
  const user = identity.userId ?? 'unknown'
  const guild = identity.guildId ?? 'dm'
  const channel = identity.channelId ?? 'unknown'
  switch (scope) {
    case 'user':
      return `${commandName}:concurrency:user:${user}`
    case 'guild':
      return `${commandName}:concurrency:guild:${guild}`
    case 'channel':
      return `${commandName}:concurrency:channel:${channel}`
    case 'global':
      return `${commandName}:concurrency:global`
  }
}

export function tryAcquireConcurrency(
  key: string,
  limit: number,
): (() => void) | null {
  const current = counts.get(key) ?? 0
  if (current >= limit) return null
  counts.set(key, current + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    const value = counts.get(key) ?? 0
    if (value <= 1) counts.delete(key)
    else counts.set(key, value - 1)
  }
}

export function clearConcurrency(): void {
  counts.clear()
}
