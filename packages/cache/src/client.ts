export type RedisClient = Bun.RedisClient

let redis: RedisClient | undefined
let redisUrl: string | undefined
let connectionPromise: Promise<RedisClient> | undefined
const clients = new Set<RedisClient>()

function redisOptions() {
  return {
    autoReconnect: true,
    maxRetries: 20,
    connectionTimeout: 10_000,
  }
}

export async function connectRedis(url: string): Promise<RedisClient> {
  if (redis?.connected) {
    return redis
  }

  if (!url) {
    throw new Error('VALKEY_URL is not configured')
  }

  redisUrl = url

  connectionPromise ??= (async () => {
    const client = new Bun.RedisClient(url, redisOptions())

    try {
      await client.connect()
      redis = client
      clients.add(client)
      return client
    } catch (error) {
      try {
        client.close()
      } catch {
        // Ignore cleanup errors.
      }
      throw error
    }
  })().catch((error: unknown) => {
    connectionPromise = undefined
    redis = undefined
    throw error
  })

  return connectionPromise
}

export function getRedis(): RedisClient {
  if (!redis || !redis.connected) {
    throw new Error('Redis is not connected')
  }

  return redis
}

export async function createRedisSubscriber(): Promise<RedisClient> {
  const url = redisUrl ?? process.env.VALKEY_URL ?? process.env.REDIS_URL
  if (!url) {
    throw new Error('VALKEY_URL is not configured')
  }

  const client = new Bun.RedisClient(url, redisOptions())

  try {
    await client.connect()
    clients.add(client)
    return client
  } catch (error) {
    try {
      client.close()
    } catch {
      // Ignore cleanup errors.
    }
    throw error
  }
}

export async function disconnectRedis(): Promise<void> {
  connectionPromise = undefined
  redis = undefined
  redisUrl = undefined

  const activeClients = [...clients]
  clients.clear()

  await Promise.allSettled(
    activeClients.map(async (client) => {
      try {
        client.close()
      } catch {
        // Ignore close errors during shutdown.
      }
    }),
  )
}
