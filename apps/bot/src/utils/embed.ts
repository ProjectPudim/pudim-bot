import { EmbedBuilder } from '@fluxerjs/core'
import { colors } from './constants'
import { collectFlags } from './flags'

export interface EmbedField {
  name: string
  value: string | string[]
  inline?: boolean
}

export interface EmbedFooter {
  text: string
  iconUrl?: string
}

export interface EmbedAuthor {
  name: string
  iconUrl?: string
  url?: string
}

export interface EmbedOptions {
  title?: string
  description?: string | string[]
  color?: string
  author?: EmbedAuthor
  fields?: EmbedField[]
  thumbnail?: string
  image?: string
  footer?: EmbedFooter
  timestamp?: boolean
}

const MAX_FIELDS = 25

const join = (text: string | string[]) =>
  Array.isArray(text) ? text.join('\n') : text

export function Embed(
  description: string | string[],
  color?: string,
): EmbedBuilder
export function Embed(options: EmbedOptions): EmbedBuilder

export function Embed(
  inputOrDescription: string | string[] | EmbedOptions,
  color?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()

  if (
    typeof inputOrDescription === 'string' ||
    Array.isArray(inputOrDescription)
  ) {
    embed.setDescription(join(inputOrDescription))
    embed.setColor(color ?? colors.primary)
    return embed
  }

  const options = inputOrDescription

  if (options.author?.name) {
    embed.setAuthor({
      name: options.author.name,
      iconURL: options.author.iconUrl,
      url: options.author.url,
    })
  }

  if (options.title) embed.setTitle(options.title)
  if (options.description) embed.setDescription(join(options.description))

  embed.setColor(options.color ?? colors.primary)

  if (options.fields?.length) {
    const fields = options.fields
      .map((f) => ({
        name: f.name.trim(),
        value: join(f.value).trim(),
        inline: f.inline ?? false,
      }))
      .filter((f) => f.name && f.value)
      .slice(0, MAX_FIELDS)

    if (fields.length) embed.addFields(...fields)
  }

  if (options.thumbnail) embed.setThumbnail(options.thumbnail)
  if (options.image) embed.setImage(options.image)
  if (options.footer) {
    embed.setFooter({
      text: options.footer.text,
      iconURL: options.footer.iconUrl,
    })
  }
  if (options.timestamp === true) embed.setTimestamp()

  return embed
}

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

/**
 * Embed as API JSON, except `timestamp` is a boolean
 * `true` means "show the message send time" (`embed.setTimestamp()`); absent otherwise
 */
export interface EmbedJson {
  title?: string
  /** `null` when no description (API requires the field) */
  description: string | null
  /** Color as 0xRRGGBB integer */
  color?: number
  /** `true` if the user requested a timestamp; never `false` */
  timestamp?: true
  image?: { url: string }
  thumbnail?: { url: string }
  footer?: { text: string; icon_url?: string }
  author?: { name: string; icon_url?: string; url?: string }
}

/**
 * `params` lists the arguments that caused the error:
 * - `unknownArgument`: flags as typed (e.g. `--foorter.icon`)
 * - `unexpectedText`: loose text before the first flag
 * - `emptyEmbed`: empty list
 * - other codes: canonical English names (e.g. `footer.text`, `color`),
 *   even when an alias was typed (`--rodape`, `--cor`)
 */
export interface ParseEmbedError {
  error: true
  code: ParseEmbedErrorCode
  params: string[]
}

export type ParseEmbedResult =
  ParseEmbedError | { error: false; embed: EmbedJson }

// Embed API limits; adjust here if Fluxer differs
export const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  footerText: 2048,
  authorName: 256,
  total: 6000,
  url: 2048,
} as const

/**
 * Accepted names per argument; first in each list is canonical (English),
 * then Portuguese and Spanish. Accents and case are ignored;
 * `-`/`_` act as `.` (e.g. `--rodape-texto` = `--rodape.texto`)
 */
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

// `--word` or `--word.word` (accents and `-`/`_` as separator)
const FLAG = /^--(\p{L}+(?:[._-]\p{L}+)?)$/u
const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Lowercase, accent-free, `.` as separator */
const normalize = (name: string) =>
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
    for (const alias of aliases) map.set(normalize(alias), canonical)
  }
  return map
})()

const fail = (
  code: ParseEmbedErrorCode,
  ...params: string[]
): ParseEmbedError => ({ error: true, code, params })

/** Counts characters (emojis count as 1) */
const size = (text: string) => [...text].length

function isValidUrl(value: string, imageOnly: boolean): boolean {
  if (size(value) > EMBED_LIMITS.url) return false

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.username || url.password) return false

  // Require a real domain (block localhost, IPv6 and internal hosts)
  const host = url.hostname
  if (!host.includes('.') || PRIVATE_HOST.test(host)) return false

  if (imageOnly) {
    // Many CDNs serve images without extension; reject only when an extension
    // is present and not an image. Type can't be verified without a request
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

function parseBoolean(value: string): boolean | null {
  // Empty value (`--timestamp` alone) counts as enabled
  if (value === '') return true

  const v = value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  if (
    [
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
    ].includes(v)
  )
    return true
  if (['false', 'no', 'n', 'off', 'nao', 'falso', '0'].includes(v)) return false
  return null
}

/**
 * Reads `--argument value with several words` and returns raw values,
 * already keyed by canonical argument name. Everything after an argument
 * until the next `--argument` is its value
 *
 * On error, reports ALL problematic arguments at once
 */
function collect(
  args: string[],
  exclude: ReadonlySet<EmbedExcludeArgs>,
): ParseEmbedError | { error: false; raw: Map<EmbedExcludeArgs, string> } {
  return collectFlags(args, (name) => ALIAS_LOOKUP.get(normalize(name)), {
    exclude,
    pattern: FLAG,
  })
}

export interface ParseEmbedOptions {
  partial?: boolean
}

/** Validation rules for the final embed (standalone or merged) */
function checkEmbed(
  embed: EmbedJson,
  requireContent: boolean,
): ParseEmbedError | null {
  // Need visible content (color or timestamp alone is not an embed)
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

  // Sum of all text lengths
  const total =
    size(embed.title ?? '') +
    size(embed.description ?? '') +
    size(embed.footer?.text ?? '') +
    size(embed.author?.name ?? '')
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

/**
 * Applies `patch` (from `parseEmbed(..., { partial: true })`) onto the saved
 * embed: only provided fields are updated, the rest kept. Re-validates
 * content and total size after merging
 */
export function mergeEmbed(
  current: EmbedJson | null | undefined,
  patch: EmbedJson,
): ParseEmbedResult {
  const { description, ...rest } = patch

  const merged: EmbedJson = {
    ...current,
    ...rest,
    // `null` in patch means description omitted, keep current
    description: description ?? current?.description ?? null,
  }

  const invalid = checkEmbed(merged, true)
  if (invalid) return invalid

  return { error: false, embed: merged }
}

/**
 * Converts `args` into an embed JSON, validating everything before returning
 *
 * Usage example:
 *   --title Title --description Line 1\nLine 2 --color #F7D174
 *   --footer.text Footer --footer.icon https://site.com/icon.png --timestamp
 *
 * Also works in Portuguese and Spanish (see `EMBED_ALIASES`):
 *   --titulo Título --descricao Texto --cor #F7D174 --rodape Equipe
 *
 * @param exclude canonical argument names that cannot be used in this command
 * @param options.partial use when the result will be merged with an existing
 *   embed (see `mergeEmbed`): accepts only `--color`, for example. In that mode,
 *   `description: null` means "not provided"
 */
export function parseEmbed(
  args: string[],
  exclude: EmbedExcludeArgs[] = [],
  options: ParseEmbedOptions = {},
): ParseEmbedResult {
  const collected = collect(args, new Set(exclude))
  if (collected.error) return collected

  const { raw } = collected
  if (raw.size === 0) return fail('emptyEmbed')

  // Arguments without value (except `timestamp`, which may stand alone)
  const empty = [...raw]
    .filter(([name, value]) => value === '' && name !== 'timestamp')
    .map(([name]) => name)
  if (empty.length) return fail('emptyArgument', ...empty)

  const embed: EmbedJson = { description: null }

  const title = raw.get('title')
  if (title !== undefined) {
    if (size(title) > EMBED_LIMITS.title) return fail('titleTooLong', 'title')
    embed.title = title
  }

  const description = raw.get('description')
  if (description !== undefined) {
    if (size(description) > EMBED_LIMITS.description)
      return fail('descriptionTooLong', 'description')
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
    if (!isValidUrl(thumbnail, true))
      return fail('invalidThumbnailUrl', 'thumbnail')
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
    if (footerText === undefined)
      return fail('footerIconRequiresText', 'footer.icon')
    if (size(footerText) > EMBED_LIMITS.footerText)
      return fail('footerTextTooLong', 'footer.text')
    if (footerIcon !== undefined && !isValidUrl(footerIcon, true))
      return fail('invalidFooterIconUrl', 'footer.icon')

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
    if (size(authorName) > EMBED_LIMITS.authorName)
      return fail('authorNameTooLong', 'author.name')
    if (authorIcon !== undefined && !isValidUrl(authorIcon, true))
      return fail('invalidAuthorIconUrl', 'author.icon')
    if (authorUrl !== undefined && !isValidUrl(authorUrl, false))
      return fail('invalidAuthorUrl', 'author.url')

    embed.author = { name: authorName }
    if (authorIcon !== undefined) embed.author.icon_url = authorIcon
    if (authorUrl !== undefined) embed.author.url = authorUrl
  }

  const invalid = checkEmbed(embed, !options.partial)
  if (invalid) return invalid

  return { error: false, embed }
}
