import { logger } from '#bot/utils/logger'

export interface GiveawayOperation {
  operationId: string
  operation: string
  method?: string
  path?: string
  request?: unknown
}

const reported = new WeakSet<object>()
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null

function causes(error: unknown) {
  const chain: Record<string, unknown>[] = []
  let current = object(error)
  while (current && chain.length < 8 && !chain.includes(current)) {
    chain.push(current)
    current = object(current.cause)
  }
  return chain
}

export function httpStatus(error: unknown): number | undefined {
  for (const cause of causes(error)) {
    if (typeof cause.statusCode === 'number') return cause.statusCode
    if (typeof cause.status === 'number') return cause.status
  }
  return undefined
}

export function apiCode(error: unknown): unknown {
  const chain = causes(error)
  const api = chain.find(
    (cause) =>
      typeof cause.statusCode === 'number' || typeof cause.status === 'number',
  )
  return api?.code ?? object(api?.rawBody)?.code
}

function safeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value
    .replace(/\b(Bot|Bearer)\s+[^\s,;]+/gi, '$1 [REDACTED]')
    .replace(/(?:https?|mongodb(?:\+srv)?|rediss?):\/\/[^\s]+/gi, '[URL]')
    .replace(
      /((?:token|password|secret|authorization|cookie)\s*[=:]\s*)[^\s,;]+/gi,
      '$1[REDACTED]',
    )
    .slice(0, 600)
}

function safePath(value: unknown) {
  if (typeof value !== 'string') return undefined
  const path = value.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0]!
  return path
    .replace(/\/(invites|webhooks)\/[^/]+(?:\/[^/]+)?/g, '/$1/[REDACTED]')
    .slice(0, 250)
}

function requestShape(value: unknown) {
  const body = object(value)
  if (!body) return undefined
  const type = (item: unknown) =>
    item === null ? 'null' : Array.isArray(item) ? 'array' : typeof item
  return {
    fields: Object.fromEntries(
      Object.entries(body).map(([key, item]) => [key, type(item)]),
    ),
    nonceLength: typeof body.nonce === 'string' ? body.nonce.length : undefined,
    contentLength:
      typeof body.content === 'string' ? body.content.length : undefined,
    invite: Object.fromEntries(
      ['max_age', 'max_uses', 'temporary', 'unique']
        .filter((key) => key in body)
        .map((key) => [
          key,
          typeof body[key] === 'number' || typeof body[key] === 'boolean'
            ? body[key]
            : type(body[key]),
        ]),
    ),
    embeds: Array.isArray(body.embeds)
      ? body.embeds.slice(0, 2).map((value) => {
          const embed = object(value) ?? {}
          return {
            titleLength:
              typeof embed.title === 'string' ? embed.title.length : undefined,
            descriptionLength:
              typeof embed.description === 'string'
                ? embed.description.length
                : undefined,
            color:
              typeof embed.color === 'number' ? embed.color : type(embed.color),
            fields: Array.isArray(embed.fields)
              ? embed.fields.length
              : undefined,
          }
        })
      : undefined,
  }
}

function validationDetails(
  value: unknown,
  path = '',
  depth = 0,
): { path: string; code?: string; message?: string }[] {
  if (depth > 6) return []
  if (Array.isArray(value))
    return value
      .slice(0, 30)
      .flatMap((item) => validationDetails(item, path, depth + 1))
      .slice(0, 30)
  const record = object(value)
  if (!record) return []
  if (typeof record.message === 'string') {
    const field = safeText(record.path) ?? path
    return [
      {
        path: field,
        code: safeText(record.code),
        message: /token|password|secret|authorization|cookie/i.test(field)
          ? '[REDACTED]'
          : safeText(record.message),
      },
    ]
  }
  return Object.entries(record)
    .flatMap(([key, item]) =>
      validationDetails(
        item,
        key === '_errors' ? path : [path, key].filter(Boolean).join('.'),
        depth + 1,
      ),
    )
    .slice(0, 30)
}

export function logGiveawayFailure(error: unknown, context: GiveawayOperation) {
  const chain = causes(error)
  if (chain.some((cause) => reported.has(cause))) return
  chain.forEach((cause) => reported.add(cause))
  const api =
    chain.find(
      (cause) =>
        typeof cause.statusCode === 'number' ||
        typeof cause.status === 'number',
    ) ?? chain.at(-1)
  const raw = object(api?.rawBody)
  logger.error('[Giveaway] operation failed', {
    operationId: context.operationId,
    operation: context.operation,
    method: safeText(context.method ?? api?.method),
    path: safePath(context.path ?? api?.path),
    status: httpStatus(error),
    code:
      typeof api?.code === 'number'
        ? api.code
        : safeText(api?.code ?? raw?.code),
    errorType: safeText(api?.name),
    message: safeText(api?.message ?? raw?.message) ?? safeText(error),
    validation: validationDetails(api?.errors ?? raw?.errors),
    request: requestShape(context.request),
  })
}

export async function giveawayOperation<T>(
  context: GiveawayOperation,
  action: () => T | PromiseLike<T>,
): Promise<T> {
  try {
    return await action()
  } catch (error) {
    logGiveawayFailure(error, context)
    throw error
  }
}
