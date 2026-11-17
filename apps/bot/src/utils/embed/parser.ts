import { collectFlags } from '../flags'

export type EmbedExcludeArgs =
  | 'title'
  | 'description'
  | 'color'
  | 'image'
  | 'thumbnail'
  | 'timestamp'
  | 'footer.text'
  | 'footer.icon'
  | 'author.name'
  | 'author.icon'
  | 'author.url'

export type ParseEmbedErrorCode =
  | 'emptyEmbed'
  | 'unexpectedText'
  | 'unknownArgument'
  | 'argumentNotAllowed'
  | 'duplicateArgument'
  | 'emptyArgument'
  | 'titleTooLong'
  | 'descriptionTooLong'
  | 'footerTextTooLong'
  | 'authorNameTooLong'
  | 'embedTooLong'
  | 'invalidColor'
  | 'invalidTimestamp'
  | 'invalidImageUrl'
  | 'invalidThumbnailUrl'
  | 'invalidFooterIconUrl'
  | 'invalidAuthorIconUrl'
  | 'invalidAuthorUrl'
  | 'footerIconRequiresText'
  | 'authorRequiresName'

export interface EmbedArgs {
  title?: string
  description?: string
  color?: string
  image?: string
  thumbnail?: string
  timestamp?: boolean
  footer?: {
    text?: string
    icon?: string
  }
  author?: {
    name?: string
    icon?: string
    url?: string
  }
}

export interface EmbedJson {
  title?: string
  description: string | null
  color?: number
  timestamp?: true
  image?: { url: string }
  thumbnail?: { url: string }
  footer?: { text: string; icon_url?: string }
  author?: { name: string; icon_url?: string; url?: string }
}

export interface ParseEmbedError {
  error: true
  code: ParseEmbedErrorCode
  params: string[]
}

export type ParseEmbedResult =
  ParseEmbedError | { error: false; embed: EmbedJson }

export interface ParseEmbedOptions {
  partial?: boolean
}

export const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  footerText: 2048,
  authorName: 256,
  total: 6000,
  url: 2048,
} as const

export const EMBED_ALIASES: Record<EmbedExcludeArgs, readonly string[]> = {
  title: ['title', 'titulo'],
  description: ['description', 'desc', 'descricao', 'descripcion'],
  color: ['color', 'colour', 'cor'],
  image: ['image', 'img', 'imagem', 'imagen'],
  thumbnail: ['thumbnail', 'thumb', 'miniatura'],
  timestamp: ['timestamp', 'data', 'horario', 'fecha', 'hora'],
  'footer.text': [
    'footer.text',
    'footer',
    'rodape.texto',
    'rodape',
    'pie.texto',
    'pie',
  ],
  'footer.icon': ['footer.icon', 'rodape.icone', 'pie.icono'],
  'author.name': [
    'author.name',
    'author',
    'autor.nome',
    'autor.nombre',
    'autor',
  ],
  'author.icon': ['author.icon', 'autor.icone', 'autor.icono'],
  'author.url': ['author.url', 'autor.url'],
}

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'bmp',
])

const PRIVATE_HOST =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/
const FLAG_PATTERN = /^--(\p{L}+(?:[._-]\p{L}+)?)$/u
const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

const normalizeFlagName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[_-]/g, '.')

const ALIAS_LOOKUP: ReadonlyMap<string, EmbedExcludeArgs> = (() => {
  const map = new Map<string, EmbedExcludeArgs>()
  for (const [canonical, aliases] of Object.entries(EMBED_ALIASES) as [
    EmbedExcludeArgs,
    readonly string[],
  ][]) {
    for (const alias of aliases) map.set(normalizeFlagName(alias), canonical)
  }
  return map
})()

const fail = (
  code: ParseEmbedErrorCode,
  ...params: string[]
): ParseEmbedError => ({ error: true, code, params })

const charCount = (text: string) => [...text].length

function isValidUrl(value: string, imageOnly: boolean): boolean {
  if (charCount(value) > EMBED_LIMITS.url) return false

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.username || url.password) return false

  const host = url.hostname
  if (!host.includes('.') || PRIVATE_HOST.test(host)) return false

  if (imageOnly) {
    const ext = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1]?.toLowerCase()
    if (ext && !IMAGE_EXTENSIONS.has(ext)) return false
  }

  return true
}

function parseColor(value: string): number | null {
  const hex = HEX_COLOR.exec(value)?.[1]
  if (!hex) return null
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  return Number.parseInt(full, 16)
}

const TRUE_VALUES = new Set([
  'true',
  'yes',
  'y',
  'on',
  'sim',
  's',
  'si',
  'verdadeiro',
  'verdadero',
  '1',
])

const FALSE_VALUES = new Set(['false', 'no', 'n', 'off', 'nao', 'falso', '0'])

function parseBoolean(value: string): boolean | null {
  if (value === '') return true
  const normalized = value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  if (TRUE_VALUES.has(normalized)) return true
  if (FALSE_VALUES.has(normalized)) return false
  return null
}

function checkEmbed(
  embed: EmbedJson,
  requireContent: boolean,
): ParseEmbedError | null {
  if (requireContent) {
    const hasContent =
      embed.title ||
      embed.description ||
      embed.image ||
      embed.thumbnail ||
      embed.footer ||
      embed.author
    if (!hasContent) return fail('emptyEmbed')
  }

  const total =
    charCount(embed.title ?? '') +
    charCount(embed.description ?? '') +
    charCount(embed.footer?.text ?? '') +
    charCount(embed.author?.name ?? '')

  if (total > EMBED_LIMITS.total) {
    const contributing: string[] = []
    if (embed.title) contributing.push('title')
    if (embed.description) contributing.push('description')
    if (embed.footer) contributing.push('footer.text')
    if (embed.author) contributing.push('author.name')
    return fail('embedTooLong', ...contributing)
  }

  return null
}

export function mergeEmbed(
  current: EmbedJson | null | undefined,
  patch: EmbedJson,
): ParseEmbedResult {
  const { description, ...rest } = patch

  const merged: EmbedJson = {
    ...current,
    ...rest,
    description: description ?? current?.description ?? null,
  }

  const invalid = checkEmbed(merged, true)
  if (invalid) return invalid

  return { error: false, embed: merged }
}

export function parseEmbed(
  args: string[],
  exclude: EmbedExcludeArgs[] = [],
  options: ParseEmbedOptions = {},
): ParseEmbedResult {
  const collected = collectFlags(
    args,
    (name) => ALIAS_LOOKUP.get(normalizeFlagName(name)),
    {
      exclude: new Set(exclude),
      pattern: FLAG_PATTERN,
    },
  )
  if (collected.error) return collected

  const { raw } = collected
  if (raw.size === 0) return fail('emptyEmbed')

  const empty = [...raw]
    .filter(([name, value]) => value === '' && name !== 'timestamp')
    .map(([name]) => name)
  if (empty.length) return fail('emptyArgument', ...empty)

  const embed: EmbedJson = { description: null }

  const title = raw.get('title')
  if (title !== undefined) {
    if (charCount(title) > EMBED_LIMITS.title) {
      return fail('titleTooLong', 'title')
    }
    embed.title = title
  }

  const description = raw.get('description')
  if (description !== undefined) {
    if (charCount(description) > EMBED_LIMITS.description) {
      return fail('descriptionTooLong', 'description')
    }
    embed.description = description
  }

  const color = raw.get('color')
  if (color !== undefined) {
    const parsed = parseColor(color)
    if (parsed === null) return fail('invalidColor', 'color')
    embed.color = parsed
  }

  const image = raw.get('image')
  if (image !== undefined) {
    if (!isValidUrl(image, true)) return fail('invalidImageUrl', 'image')
    embed.image = { url: image }
  }

  const thumbnail = raw.get('thumbnail')
  if (thumbnail !== undefined) {
    if (!isValidUrl(thumbnail, true)) {
      return fail('invalidThumbnailUrl', 'thumbnail')
    }
    embed.thumbnail = { url: thumbnail }
  }

  if (raw.has('timestamp')) {
    const enabled = parseBoolean(raw.get('timestamp') ?? '')
    if (enabled === null) return fail('invalidTimestamp', 'timestamp')
    if (enabled) embed.timestamp = true
  }

  const footerText = raw.get('footer.text')
  const footerIcon = raw.get('footer.icon')
  if (footerText !== undefined || footerIcon !== undefined) {
    if (footerText === undefined) {
      return fail('footerIconRequiresText', 'footer.icon')
    }
    if (charCount(footerText) > EMBED_LIMITS.footerText) {
      return fail('footerTextTooLong', 'footer.text')
    }
    if (footerIcon !== undefined && !isValidUrl(footerIcon, true)) {
      return fail('invalidFooterIconUrl', 'footer.icon')
    }

    embed.footer = { text: footerText }
    if (footerIcon !== undefined) embed.footer.icon_url = footerIcon
  }

  const authorName = raw.get('author.name')
  const authorIcon = raw.get('author.icon')
  const authorUrl = raw.get('author.url')
  if (
    authorName !== undefined ||
    authorIcon !== undefined ||
    authorUrl !== undefined
  ) {
    if (authorName === undefined) {
      const present: string[] = []
      if (authorIcon !== undefined) present.push('author.icon')
      if (authorUrl !== undefined) present.push('author.url')
      return fail('authorRequiresName', ...present)
    }
    if (charCount(authorName) > EMBED_LIMITS.authorName) {
      return fail('authorNameTooLong', 'author.name')
    }
    if (authorIcon !== undefined && !isValidUrl(authorIcon, true)) {
      return fail('invalidAuthorIconUrl', 'author.icon')
    }
    if (authorUrl !== undefined && !isValidUrl(authorUrl, false)) {
      return fail('invalidAuthorUrl', 'author.url')
    }

    embed.author = { name: authorName }
    if (authorIcon !== undefined) embed.author.icon_url = authorIcon
    if (authorUrl !== undefined) embed.author.url = authorUrl
  }

  const invalid = checkEmbed(embed, !options.partial)
  if (invalid) return invalid

  return { error: false, embed }
}
