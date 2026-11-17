import { i18n, type TranslateFunction } from '#bot/i18n'

export type DurationUnit =
  'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export interface ParseDurationOptions {
  defaultUnit?: DurationUnit
  min?: number
  max?: number
}

export type ParseDurationResult =
  { ok: true; ms: number } | { ok: false; reason: 'invalid' | 'min' | 'max' }

export const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000
export const MAX_SLOWMODE_MS = 6 * 60 * 60 * 1000

const UNIT_MS: Record<DurationUnit, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_628_000_000,
  year: 31_536_000_000,
}

const UNIT_KEYS = {
  second: 'common.duration.seconds',
  minute: 'common.duration.minutes',
  hour: 'common.duration.hours',
  day: 'common.duration.days',
  week: 'common.duration.weeks',
  month: 'common.duration.months',
  year: 'common.duration.years',
} as const

const UNIT_ALIASES: Record<string, DurationUnit> = {
  s: 'second',
  sec: 'second',
  secs: 'second',
  second: 'second',
  seconds: 'second',
  seg: 'second',
  segs: 'second',
  segundo: 'second',
  segundos: 'second',

  m: 'minute',
  min: 'minute',
  mins: 'minute',
  minute: 'minute',
  minutes: 'minute',
  minuto: 'minute',
  minutos: 'minute',

  h: 'hour',
  hr: 'hour',
  hrs: 'hour',
  hour: 'hour',
  hours: 'hour',
  hora: 'hour',
  horas: 'hour',

  d: 'day',
  day: 'day',
  days: 'day',
  dia: 'day',
  dias: 'day',

  w: 'week',
  wk: 'week',
  wks: 'week',
  week: 'week',
  weeks: 'week',
  sem: 'week',
  semana: 'week',
  semanas: 'week',

  mo: 'month',
  month: 'month',
  months: 'month',
  mes: 'month',
  meses: 'month',

  y: 'year',
  year: 'year',
  years: 'year',
  ano: 'year',
  anos: 'year',
}

const HARD_MAX_MS = 100 * 365 * 24 * 60 * 60 * 1000

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .toLowerCase()
    .trim()
}

export function parseDuration(
  input: string,
  options: ParseDurationOptions = {},
): ParseDurationResult {
  if (!input) return { ok: false, reason: 'invalid' }

  const normalized = normalize(input)
  if (/\d,\d/.test(normalized)) return { ok: false, reason: 'invalid' }

  const cleaned = normalized
    .replace(/,/g, ' ')
    .replace(/\b(?:e|and)\b/g, ' ')
    .trim()

  if (!cleaned) return { ok: false, reason: 'invalid' }

  const partPattern = /(\d+)\s*([a-z]+)?/g
  const seen = new Set<DurationUnit>()
  let cursor = 0
  let total = 0
  let matched = false

  for (const match of cleaned.matchAll(partPattern)) {
    const index = match.index ?? 0
    if (cleaned.slice(cursor, index).trim()) {
      return { ok: false, reason: 'invalid' }
    }
    cursor = index + match[0].length

    const rawValue = match[1]
    if (!rawValue) return { ok: false, reason: 'invalid' }

    const value = Number(rawValue)
    if (!Number.isSafeInteger(value) || value <= 0) {
      return { ok: false, reason: 'invalid' }
    }

    const alias = match[2]
    const unit = alias ? UNIT_ALIASES[alias] : options.defaultUnit
    if (!unit || seen.has(unit)) return { ok: false, reason: 'invalid' }
    seen.add(unit)

    const unitMs = UNIT_MS[unit]
    if (value > Math.floor(HARD_MAX_MS / unitMs)) {
      return { ok: false, reason: 'invalid' }
    }

    total += value * unitMs
    if (!Number.isSafeInteger(total) || total > HARD_MAX_MS) {
      return { ok: false, reason: 'invalid' }
    }

    matched = true
  }

  if (!matched || cleaned.slice(cursor).trim()) {
    return { ok: false, reason: 'invalid' }
  }
  if (options.min !== undefined && total < options.min) {
    return { ok: false, reason: 'min' }
  }
  if (options.max !== undefined && total > options.max) {
    return { ok: false, reason: 'max' }
  }

  return { ok: true, ms: total }
}

export interface ParsedDurationArgs {
  result: ParseDurationResult
  duration: string
  rest: string[]
}

export function parseDurationArgs(
  args: string[],
  options: ParseDurationOptions = {},
): ParsedDurationArgs {
  for (let end = args.length; end >= 1; end--) {
    const duration = args.slice(0, end).join(' ').trim()
    if (!duration) continue

    const result = parseDuration(duration, options)
    if (result.ok || result.reason !== 'invalid') {
      return { result, duration, rest: args.slice(end) }
    }
  }

  return {
    result: { ok: false, reason: 'invalid' },
    duration: args.join(' ').trim(),
    rest: [],
  }
}

export function formatDuration(
  ms: number,
  localeOrT: string | TranslateFunction,
): string {
  const t =
    typeof localeOrT === 'string' ? i18n.getTranslator(localeOrT) : localeOrT

  const totalSeconds = Math.max(
    0,
    Math.round((Number.isFinite(ms) ? ms : 0) / 1_000),
  )

  if (totalSeconds === 0) return t('common.duration.seconds', 0)

  const units: Array<[DurationUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_628_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
  ]

  let remaining = totalSeconds
  const parts: string[] = []

  for (const [unit, seconds] of units) {
    const value = Math.floor(remaining / seconds)
    if (value <= 0) continue

    parts.push(t(UNIT_KEYS[unit], value))
    remaining -= value * seconds
  }

  if (parts.length === 0) return t('common.duration.seconds', 0)
  if (parts.length === 1) return parts[0]!

  const last = parts.pop()!
  return `${parts.join(', ')} ${t('common.and')} ${last}`
}
