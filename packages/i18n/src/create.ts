import type {
  GetValueByPath,
  NestedKeys,
  TranslateArgs,
  TranslateFunction,
  TranslationShape,
  TranslationTree,
} from './types'

export interface I18nOptions {
  onMissingKey?: (locale: string, key: string) => void
  random?: () => number
}

function getValue(dictionary: unknown, key: string): unknown {
  let value: unknown = dictionary

  for (const part of key.split('.')) {
    if (
      value === null ||
      typeof value !== 'object' ||
      !Object.hasOwn(value, part)
    ) {
      return undefined
    }

    value = (value as Record<string, unknown>)[part]
  }

  return value
}

function pick(value: string | readonly string[], random: () => number): string {
  if (typeof value === 'string') {
    return value
  }

  if (value.length === 0) {
    return ''
  }

  const index = Math.min(
    value.length - 1,
    Math.max(0, Math.floor(random() * value.length)),
  )

  return value[index] ?? ''
}

export function createI18n<
  const Locales extends Record<string, TranslationTree>,
  const DefaultLocale extends keyof Locales & string,
>(
  defaultLocale: DefaultLocale,
  locales: Locales & {
    readonly [L in keyof Locales]: TranslationShape<Locales[DefaultLocale]>
  },
  options: I18nOptions = {},
) {
  type Locale = keyof Locales & string
  type Default = Locales[DefaultLocale]
  type Key = NestedKeys<Default>

  const fallback = locales[defaultLocale]
  const random = options.random ?? Math.random

  function resolveLocale(locale?: string | null): Locale {
    if (locale && Object.hasOwn(locales, locale)) {
      return locale as Locale
    }

    return defaultLocale
  }

  function render(
    locale: string | null | undefined,
    key: string,
    args: readonly unknown[],
  ): string {
    const resolved = resolveLocale(locale)

    const value = getValue(locales[resolved], key) ?? getValue(fallback, key)

    if (value === undefined) {
      options.onMissingKey?.(resolved, key)
      return key
    }

    const result =
      typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown)(...args)
        : value

    if (typeof result === 'string' || Array.isArray(result)) {
      return pick(result as string | readonly string[], random)
    }

    options.onMissingKey?.(resolved, key)
    return key
  }

  function translate<K extends Key>(
    locale: string | null | undefined,
    key: K,
    ...args: TranslateArgs<GetValueByPath<Default, K>>
  ): string {
    return render(locale, key, args)
  }

  function getTranslator(locale?: string | null): TranslateFunction<Default> {
    return ((key: string, ...args: unknown[]) =>
      render(locale, key, args)) as TranslateFunction<Default>
  }

  return {
    defaultLocale,
    locales: Object.keys(locales) as Locale[],
    resolveLocale,
    translate,
    getTranslator,
  }
}
