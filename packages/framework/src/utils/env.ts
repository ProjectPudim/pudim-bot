import { format, styleText } from 'node:util'
import type { StandardSchemaV1 } from './standard-schema.js'

export async function validateEnv<const T extends StandardSchemaV1>(
  schema: T,
): Promise<StandardSchemaV1.InferOutput<T>> {
  const result = await schema['~standard'].validate(process.env)
  if (result.issues) {
    const message = result.issues
      .map((issue) =>
        format(
          styleText('red', 'ENV VAR %s -> %s'),
          styleText(
            'bold',
            issue.path
              ?.map((segment) =>
                String(typeof segment === 'object' ? segment.key : segment),
              )
              .join('.') ?? '',
          ),
          styleText('gray', issue.message),
        ),
      )
      .join('\n')
    console.error(message)
    throw new Error('[env] Environment validation failed.\n' + message)
  }
  console.info(styleText('dim', 'Environment variables validated'))
  return result.value
}
