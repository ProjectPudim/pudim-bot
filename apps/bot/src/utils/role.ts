const ROLE_MENTION = /^<@&(\d+)>$/
const ROLE_SNOWFLAKE = /^\d{15,25}$/

export function parseRoleId(input?: string): string | null {
  if (!input) return null

  return (
    input.match(ROLE_MENTION)?.[1] ??
    (ROLE_SNOWFLAKE.test(input) ? input : null)
  )
}
