const CUSTOM_BRACKETS = /^<(a?):(\w+):(\d+)>$/
const CUSTOM_PLAIN = /^(\w+):(\d+)$/
const UNICODE_EMOJI =
  /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3)/u

export interface ParsedEmoji {
  raw: string
  id: string
  display: string
}

export function emojiIdentity(emoji: unknown): string {
  if (typeof emoji === 'string') {
    const m =
      emoji.match(CUSTOM_BRACKETS)?.[3] ?? emoji.match(CUSTOM_PLAIN)?.[2]
    return m ?? emoji.replace(/\uFE0F/g, '')
  }
  const e = emoji as { id?: string | null; name?: string | null } | null
  return e?.id ? String(e.id) : (e?.name ?? '').replace(/\uFE0F/g, '')
}

export function emojiRoute(emoji: unknown): string {
  if (typeof emoji === 'string') {
    const m = emoji.match(CUSTOM_BRACKETS)
    return encodeURIComponent(m ? `${m[2]}:${m[3]}` : emoji)
  }
  const e = emoji as { id?: string | null; name?: string | null } | null
  return encodeURIComponent(
    e?.id ? `${e.name ?? '_'}:${e.id}` : (e?.name ?? ''),
  )
}

export function parseEmoji(input?: string): ParsedEmoji | null {
  if (!input) return null

  const bracket = input.match(CUSTOM_BRACKETS)
  if (bracket) {
    return {
      raw: `${bracket[2]}:${bracket[3]}`,
      id: bracket[3]!,
      display: input,
    }
  }

  const plain = input.match(CUSTOM_PLAIN)
  if (plain) {
    return { raw: input, id: plain[2]!, display: `<:${plain[1]}:${plain[2]}>` }
  }

  if (UNICODE_EMOJI.test(input)) {
    return { raw: input, id: emojiIdentity(input), display: input }
  }

  return null
}
