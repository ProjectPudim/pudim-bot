import { redis } from 'bun'
import { connectRedis, disconnectRedis } from '@pudim/cache'
import { connectMongo, disconnectMongo } from '@pudim/database'
import { bootstrap } from '@pudim/framework'
import { RedisCooldownAdapter } from '@pudim/framework/cooldown/redis'
import { http } from '@pudim/shared/http'
import { logger } from '#bot/utils/logger'
import { env } from './env'
import { i18n } from './i18n'

let closing = false
let app: Awaited<ReturnType<typeof bootstrap>> | undefined

async function shutdown(code = 0): Promise<void> {
  if (closing) return
  closing = true

  const timeout = setTimeout(() => {
    process.exit(1)
  }, 3000)
  timeout.unref()

  try {
    if (app) {
      await app.dispose()
      await app.client.destroy()
    }

    await Promise.allSettled([disconnectMongo(), disconnectRedis()])

    logger.info('The bot has been stopped')
  } catch (error) {
    logger.error('Error stopping the bot', error)
    code = 1
  } finally {
    clearTimeout(timeout)
    process.exit(code)
  }
}

process.once('SIGINT', () => {
  void shutdown()
})

process.once('SIGTERM', () => {
  void shutdown()
})

try {
  await Promise.all([
    connectMongo(env.MONGODB_URI),
    connectRedis(env.VALKEY_URL),
  ])

  logger.success('The MongoDB and Redis have been connected')

  app = await bootstrap({
    meta: import.meta,

    decorateContext(ctx) {
      ctx.t = i18n.getTranslator('pt-BR')
      ctx.locale = 'pt-BR'
      ctx.logger = logger
    },
    logger,
    beforeLoad() {
      http.init()
    },

    adapters: {
      cooldown: new RedisCooldownAdapter(redis, { prefix: 'pudim:' }),
    },
  })

  logger.success('The bot has been started')
} catch (error) {
  logger.error('Error starting the bot', error)
  await shutdown(1)
}
