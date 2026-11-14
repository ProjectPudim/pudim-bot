import type { Locale } from '#bot/i18n'
import { config } from './config'

export const Category = {
  Utilities: 'utility',
  // Moderation: 'moderation',
  // Fun: 'fun',
  // Settings: 'settings',
} as const

export type Category = (typeof Category)[keyof typeof Category]

export type DescriptionLocalization = Partial<Record<Locale, string>> & {
  'en-US': string
}

export interface CategoryDescription {
  description: string
  descriptionLocalizations: DescriptionLocalization
}

interface CategoryMetadata {
  labels: DescriptionLocalization
  descriptions: DescriptionLocalization
}

export const categories = {
  [Category.Utilities]: {
    labels: {
      'en-US': 'Utilities',
      'pt-BR': 'Utilidades',
    },
    descriptions: {
      'en-US': 'General-purpose tools and helpful commands.',
      'pt-BR': 'Ferramentas e comandos úteis para o dia a dia.',
    },
  },

  // [Category.Moderation]: {
  //   labels: {
  //     'en-US': 'Moderation',
  //     'pt-BR': 'Moderação',
  //   },
  //   descriptions: {
  //     'en-US': 'Commands to keep your server clean and safe.',
  //     'pt-BR': 'Comandos para manter o seu servidor limpo e seguro.',
  //   },
  // },

  // [Category.Fun]: {
  //   labels: {
  //     'en-US': 'Fun',
  //     'pt-BR': 'Diversão',
  //   },
  //   descriptions: {
  //     'en-US': 'Fun commands and games.',
  //     'pt-BR': 'Comandos e jogos divertidos.',
  //   },
  // },

  // [Category.Settings]: {
  //   labels: {
  //     'en-US': 'Settings',
  //     'pt-BR': 'Configurações',
  //   },
  //   descriptions: {
  //     'en-US': 'Commands to configure bot and server features.',
  //     'pt-BR': 'Comandos para configurar funcionalidades do bot e do servidor.',
  //   },
  // },
} satisfies Record<Category, CategoryMetadata>

const DEFAULT_LOCALE: Locale = config.defaultLocale as Locale

function localize(
  values: DescriptionLocalization,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return values[locale] ?? values[DEFAULT_LOCALE] ?? values['en-US']
}

export function getCategoryLabel(category: Category, locale?: Locale): string {
  return localize(categories[category].labels, locale)
}

export function getCategoryDescription(
  category: Category,
  locale?: Locale,
): string {
  return localize(categories[category].descriptions, locale)
}

export function getCategoryMetadata(category: Category): CategoryDescription {
  const { descriptions } = categories[category]

  return {
    description: descriptions['en-US'],
    descriptionLocalizations: descriptions,
  }
}
