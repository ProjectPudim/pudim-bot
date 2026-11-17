import { connectRedis, disconnectRedis, getRedis } from '@pudim/cache'
import { connectMongo, disconnectMongo } from '@pudim/database'
import { bootstrap, RedisCooldownAdapter } from '@pudim/framework'
import { http } from '@pudim/shared/http'
import { config } from '#bot/config'
import { env } from '#bot/env'
import { creators } from '#bot/fluxer'
import { i18n } from '#bot/i18n'
import { logger } from '#bot/utils/logger'

let closing = false
let app: Awaited<ReturnType<typeof bootstrap>> | undefined

async function shutdown(code = 0): Promise<void> {
  if (closing) return
  closing = true

  const timeout = setTimeout(() => {
    process.exit(1)
  }, 3_000)
  timeout.unref()

  try {
    if (app) {
      app.dispose()
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
  logger.success('MongoDB and Redis have been connected')

  app = await bootstrap({
    meta: import.meta,
    token: env.BOT_TOKEN,
    creators,
    logger,
    decorateContext(ctx) {
      ctx.locale = config.defaultLocale
      ctx.t = i18n.getTranslator(ctx.locale)
      ctx.logger = logger
    },
    async beforeLoad() {
      await http.init()
    },
    adapters: {
      cooldown: new RedisCooldownAdapter(getRedis(), { prefix: 'pudim:' }),
    },
  })

  logger.success('The bot has been started')
} catch (error) {
  logger.error('Error starting the bot', error)
  await shutdown(1)
}
