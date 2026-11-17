export function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/([*_~`|>[\]()])/g, '\\$1')
    .replace(/@/g, '@\u200b')
}

export function truncate(
  value: string,
  max: number,
  ellipsis: '…' | '...' = '…',
): string {
  if (value.length <= max) return value
  const cut = Math.max(0, max - ellipsis.length)
  return `${value.slice(0, cut).trimEnd()}${ellipsis}`
}

export function safeText(value: string, max: number): string {
  return truncate(escapeMarkdown(value), max)
}

export function toUnixTimestamp(
  value: string | number | Date | null | undefined,
): number | null {
  if (value === null || value === undefined || value === '') return null
  const time =
    value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(time) ? Math.floor(time / 1000) : null
}

export function formatTimestampPair(
  value: string | number | Date | null | undefined,
): string | null {
  const unix =
    typeof value === 'number' && value < 100_000_000_000
      ? Math.trunc(value)
      : toUnixTimestamp(value)
  if (unix === null) return null
  return `<t:${unix}:f> (<t:${unix}:R>)`
}

export function formatUserTag(user: {
  id: string
  username: string
  discriminator?: string | null
}): string {
  const discriminator = user.discriminator ?? '0'
  return `\`${user.username}#${discriminator} (${user.id})\``
}

export function safeReplyMentions(authorId: string, extraUsers: string[] = []) {
  return {
    parse: [] as ('users' | 'roles' | 'everyone')[],
    users: [...new Set([authorId, ...extraUsers])],
    roles: [] as string[],
    repliedUser: true,
  }
}
