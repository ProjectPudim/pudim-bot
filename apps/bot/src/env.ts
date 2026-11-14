import { z } from 'zod'
import { validateEnv } from '@pudim/framework'

export const env = await validateEnv(
  z.object({
    NODE_ENV: z.enum(['development', 'production']).default('development'),

    BOT_TOKEN: z.string('The token of the bot is required').min(1),
    MONGODB_URI: z.string('The MongoDB URI is required').min(1),
    VALKEY_URL: z.string('The Valkey URl is required').min(1),
  }),
)
