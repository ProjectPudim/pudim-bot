import { Client } from '@fluxerjs/core'
import { connectRedis, disconnectRedis } from '@pudim/cache'
import { connectMongo, disconnectMongo } from '@pudim/database'
import { env } from './env'
import { logger } from './utils/logger'

let closing = false
let client: Client | undefined

async function shutdown(code = 0): Promise<void> {
  if (closing) return
  closing = true

  try {
    if (client) {
      await client.destroy()
    }

    await Promise.allSettled([disconnectMongo(), disconnectRedis()])

    logger.info('The bot has been stopped')
  } catch (error) {
    logger.error('Error stopping the bot', error)
    code = 1
  } finally {
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

  logger.info('MongoDB and Valkey have been connected')

  client = new Client()

  await client.login(env.BOT_TOKEN)

  logger.info('The bot has been started')
} catch (error) {
  logger.error('Error starting the bot', error)
  await shutdown(1)
}
