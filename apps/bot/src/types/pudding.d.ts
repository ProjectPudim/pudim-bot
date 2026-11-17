import type { PermissionString } from '@fluxerjs/core'
import type { Logger } from '@pudim/shared'
import type { Locale, TranslateFunction } from '#bot/i18n'
import type { Category } from '#bot/utils/categories'

declare global {
  interface ContextExtensions {
    t: TranslateFunction
    locale: Locale
    logger: Logger
  }
  interface CommandExtensions {
    category: Category
    usage: string
    permissions: PermissionString[]
  }
  // interface EventExtensions {}
}

export {}
