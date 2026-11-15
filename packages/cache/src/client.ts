import Redis from 'ioredis'

export type RedisClient = Redis

let redis: RedisClient | undefined
let connectionPromise: Promise<RedisClient> | undefined

export async function connectRedis(url: string): Promise<RedisClient> {
  if (redis?.status === 'ready') {
    return redis
  }

  if (!url) {
    throw new Error('VALKEY_URL is not configured')
  }

  connectionPromise ??= (async () => {
    const client = new Redis(url, { lazyConnect: true })

    try {
      await client.connect()
      redis = client
      return client
    } catch (error) {
      client.disconnect()
      throw error
    }
  })().catch((error: unknown) => {
    connectionPromise = undefined
    throw error
  })

  return connectionPromise
}

export function getRedis(): RedisClient {
  if (!redis || redis.status !== 'ready') {
    throw new Error('Redis is not connected')
  }

  return redis
}

export async function createRedisSubscriber(): Promise<RedisClient> {
  const client = getRedis()
  const subscriber = client.duplicate()

  if (subscriber.status !== 'ready') {
    await subscriber.connect()
  }

  return subscriber
}

export async function disconnectRedis(): Promise<void> {
  connectionPromise = undefined

  if (redis) {
    redis.disconnect()
    redis = undefined
  }
}
