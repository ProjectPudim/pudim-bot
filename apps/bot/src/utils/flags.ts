export type FlagError = {
  error: true
  code:
    | 'unexpectedText'
    | 'unknownArgument'
    | 'argumentNotAllowed'
    | 'duplicateArgument'
  params: string[]
}

export function collectFlags<K extends string>(
  args: string[],
  resolve: (name: string) => K | undefined,
  options: {
    exclude?: ReadonlySet<K>
    allowText?: boolean
    pattern?: RegExp
  } = {},
): FlagError | { error: false; raw: Map<K, string>; text: string[] } {
  const tokens = new Map<K, string[]>()
  const text: string[] = []
  const unknown: string[] = []
  const denied = new Set<string>()
  const duplicates = new Set<string>()
  let current: string[] | null = null

  for (const original of args) {
    const token = original.normalize('NFC')
    const typed = (options.pattern ?? /^--(.*)$/u).exec(token)?.[1]
    if (typed !== undefined) {
      const name = resolve(typed)
      current = []
      if (!name) unknown.push(`--${typed}`)
      else if (options.exclude?.has(name)) denied.add(name)
      else if (tokens.has(name)) duplicates.add(name)
      else tokens.set(name, current)
    } else if (current) current.push(token)
    else text.push(token)
  }

  if (text.length && !options.allowText)
    return { error: true, code: 'unexpectedText', params: [text.join(' ')] }
  if (unknown.length)
    return { error: true, code: 'unknownArgument', params: unknown }
  if (denied.size)
    return { error: true, code: 'argumentNotAllowed', params: [...denied] }
  if (duplicates.size)
    return { error: true, code: 'duplicateArgument', params: [...duplicates] }

  return {
    error: false,
    text,
    raw: new Map(
      [...tokens].map(([key, parts]) => [
        key,
        parts.join(' ').replace(/\\n/g, '\n').trim(),
      ]),
    ),
  }
}
