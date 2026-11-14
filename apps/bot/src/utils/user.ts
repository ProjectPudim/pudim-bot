import { parseUserMention } from "@fluxerjs/core"

export function parseTargetId(raw?: string): string | null {
  if (!raw) return null

  const id = parseUserMention(raw) ?? raw.replace(/\D/g, '')
  return /^\d{17,20}$/.test(id) ? id : null
}