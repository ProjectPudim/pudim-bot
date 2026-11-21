import { escapeMarkdown } from '#bot/utils'

const BIO_TOKEN_REGEX =
  /\[([^\]\n]{1,100})\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\)){1,500})\)|<a?:\w{2,32}:\d{17,20}>/g

function sanitizeBioLinkUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return url.toString().replace(/\(/g, '%28').replace(/\)/g, '%29')
  } catch {
    return null
  }
}

function escapeToFit(raw: string, max: number): string {
  if (max <= 0) return ''
  const escaped = escapeMarkdown(raw)
  if (escaped.length <= max) return escaped

  let cut = Math.min(raw.length, max)
  while (cut > 0 && escapeMarkdown(raw.slice(0, cut)).length > max) {
    cut--
  }
  return escapeMarkdown(raw.slice(0, cut))
}

export function formatSafeBio(value: string, max: number): string {
  const input = value.slice(0, 4000)
  const tokens: Array<{ text: string } | { link: string }> = []
  let lastIndex = 0

  for (const match of input.matchAll(BIO_TOKEN_REGEX)) {
    const index = match.index ?? 0
    tokens.push({ text: input.slice(lastIndex, index) })

    if (match[1] === undefined) {
      tokens.push({ link: match[0] })
    } else {
      const url = sanitizeBioLinkUrl(match[2] ?? '')
      if (url) {
        tokens.push({ link: `[${escapeMarkdown(match[1])}](${url})` })
      } else {
        tokens.push({ text: match[0] })
      }
    }

    lastIndex = index + match[0].length
  }

  tokens.push({ text: input.slice(lastIndex) })

  const rendered = tokens.map((token) =>
    'link' in token ? token.link : escapeMarkdown(token.text),
  )
  const full = rendered.join('')
  if (full.length <= max) return full

  const budget = max - 1
  let output = ''

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if ('link' in token) {
      if (output.length + token.link.length > budget) break
      output += token.link
      continue
    }

    const piece = escapeToFit(token.text, budget - output.length)
    output += piece
    if (piece.length < (rendered[i]?.length ?? 0)) break
  }

  return `${output}…`
}
