// Caractere usado como separador visual entre o emoji de status e o texto.
const SEPARATOR = '**|**'

export const config = {
  defaultPrefix: 'p.',
  defaultLocale: 'pt-BR',
  separator(emoji: string): string {
    return `${emoji} ${SEPARATOR}`
  },
  links: {
    botInvite:
      'https://web.fluxer.app/oauth2/authorize?client_id=1562641741457141760&scope=bot&permissions=1099914669142',
    supportServer: 'https://fluxer.gg/pudim',
  },
} as const
