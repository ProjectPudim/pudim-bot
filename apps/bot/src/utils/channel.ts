import type { Client } from '@fluxerjs/core'

const CHANNEL_MENTION = /^<#(\d+)>$/
const CHANNEL_SNOWFLAKE = /^\d{17,20}$/

export function parseChannelId(input?: string): string | null {
  if (!input) return null

  return (
    input.match(CHANNEL_MENTION)?.[1] ??
    (CHANNEL_SNOWFLAKE.test(input) ? input : null)
  )
}