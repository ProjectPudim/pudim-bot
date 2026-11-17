export interface ParsedCommandArgs {
  positionals: string[]
  flags: Record<string, string | boolean | Array<string | boolean>>
}

export type ParseArgsResult =
  | { ok: true; value: ParsedCommandArgs }
  | { ok: false; error: string; code: 'UNCLOSED_QUOTE' | 'INVALID_FLAG' }

const FLAG_NAME = /^[A-Za-z][A-Za-z0-9-]*$/

export function parseCommandArgs(rawArgs: string): ParseArgsResult {
  const tokens = tokenize(rawArgs)
  if (!tokens.ok) return tokens

  const positionals: string[] = []
  const flags: ParsedCommandArgs['flags'] = {}
  let endFlags = false

  const pushFlag = (name: string, value: string | boolean) => {
    const existing = flags[name]
    if (existing === undefined) {
      flags[name] = value
    } else if (Array.isArray(existing)) {
      existing.push(value)
    } else {
      flags[name] = [existing, value]
    }
  }

  let i = 0
  while (i < tokens.value.length) {
    const token = tokens.value[i]!
    if (endFlags) {
      positionals.push(token)
      i += 1
      continue
    }
    if (token === '--') {
      endFlags = true
      i += 1
      continue
    }
    if (token.startsWith('--')) {
      const body = token.slice(2)
      if (body === '') {
        return { ok: false, error: 'Invalid flag name.', code: 'INVALID_FLAG' }
      }
      const eqIndex = body.indexOf('=')
      if (eqIndex >= 0) {
        const name = body.slice(0, eqIndex)
        const value = body.slice(eqIndex + 1)
        if (!FLAG_NAME.test(name)) {
          return {
            ok: false,
            error: `Invalid flag name: "${name}".`,
            code: 'INVALID_FLAG',
          }
        }
        pushFlag(name, value)
        i += 1
        continue
      }
      const name = body
      if (!FLAG_NAME.test(name)) {
        return {
          ok: false,
          error: `Invalid flag name: "${name}".`,
          code: 'INVALID_FLAG',
        }
      }
      const next = tokens.value[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        pushFlag(name, next)
        i += 2
        continue
      }
      pushFlag(name, true)
      i += 1
      continue
    }
    positionals.push(token)
    i += 1
  }

  return { ok: true, value: { positionals, flags } }
}

type TokenizeResult =
  | { ok: true; value: string[] }
  | { ok: false; error: string; code: 'UNCLOSED_QUOTE' }

function tokenize(input: string): TokenizeResult {
  const tokens: string[] = []
  let current = ''
  let inToken = false
  let quote: '"' | "'" | null = null
  let i = 0

  const flush = () => {
    if (inToken) {
      tokens.push(current)
      current = ''
      inToken = false
    }
  }

  while (i < input.length) {
    const ch = input[i]!

    if (quote === "'") {
      if (ch === "'") {
        quote = null
      } else {
        current += ch
      }
      i += 1
      continue
    }

    if (quote === '"') {
      if (ch === '"') {
        quote = null
        i += 1
        continue
      }
      if (ch === '\\' && (input[i + 1] === '"' || input[i + 1] === '\\')) {
        current += input[i + 1]!
        i += 2
        continue
      }
      current += ch
      i += 1
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      inToken = true
      i += 1
      continue
    }

    if (ch === '\\') {
      const next = input[i + 1]
      if (next !== undefined) {
        current += next
        inToken = true
        i += 2
        continue
      }
      current += ch
      inToken = true
      i += 1
      continue
    }

    if (/\s/.test(ch)) {
      flush()
      i += 1
      continue
    }

    current += ch
    inToken = true
    i += 1
  }

  if (quote !== null) {
    return {
      ok: false,
      error: 'Unclosed quote in arguments.',
      code: 'UNCLOSED_QUOTE',
    }
  }

  flush()
  return { ok: true, value: tokens }
}
