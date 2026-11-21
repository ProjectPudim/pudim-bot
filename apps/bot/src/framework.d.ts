import type { PermissionString } from '@fluxerjs/core'
import type { Logger } from '@pudim/shared/logger'
import type { Category } from '#bot/config'
import type { Locale, TranslateFunction } from '#bot/i18n'

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
}

export {}
