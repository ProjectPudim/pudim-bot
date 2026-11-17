import { HttpError } from './errors'
import type { ResponseType } from './types'

const BINARY_CONTENT_TYPE = /^(image|audio|video)\/|octet-stream|pdf|zip/i

export async function parseResponseBody(
  res: Response,
  type: ResponseType,
): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? ''

  if (type === 'stream') return res.body

  if (
    type === 'buffer' ||
    (type === 'auto' && BINARY_CONTENT_TYPE.test(contentType))
  ) {
    return Buffer.from(await res.arrayBuffer())
  }

  const text = await res.text()
  if (type === 'text' || (type === 'auto' && !/json/i.test(contentType))) {
    return text
  }

  if (!text.trim()) return null

  try {
    return JSON.parse(text)
  } catch (cause) {
    if (type === 'json') {
      throw new HttpError('JSON inválido na resposta.', {
        code: 'PARSE',
        retryable: false,
        status: res.status,
        cause,
      })
    }
    return text
  }
}
