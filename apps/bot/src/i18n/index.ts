import { createI18n } from '@pudim/i18n'
import ptBR from '#bot/i18n/locales/pt-BR'
import { logger } from '#bot/utils/logger'

export const i18n = createI18n(
  'pt-BR',
  {
    'pt-BR': ptBR,
  },
  {
    onMissingKey(locale, key) {
      logger.warn(`[i18n] Missing translation key "${key}" in "${locale}"`)
    },
  },
)

export type Locale = (typeof i18n.locales)[number]
export type Language = typeof ptBR
export type TranslateFunction = ReturnType<typeof i18n.getTranslator>
