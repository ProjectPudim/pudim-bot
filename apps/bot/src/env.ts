import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  BOT_TOKEN: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  VALKEY_URL: z.string().min(1),
})

const result = schema.safeParse(process.env)

if (!result.success) {
  console.error(
    result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n'),
  )
  process.exit(1)
}

export const env = result.data
