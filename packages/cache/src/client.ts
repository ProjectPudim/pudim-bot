import { RedisClient } from 'bun'

let redis: RedisClient | undefined
let connectionPromise: Promise<RedisClient> | undefined

export async function connectRedis(url: string): Promise<RedisClient> {
  if (redis?.connected) {
    return redis
  }

  if (!url) {
    throw new Error('VALKEY_URL is not configured')
  }

  connectionPromise ??= (async () => {
    const client = new RedisClient(url)

    try {
      await client.connect()
      redis = client
      return client
    } catch (error) {
      client.close()
      throw error
    }
  })().catch((error: unknown) => {
    connectionPromise = undefined
    throw error
  })

  return connectionPromise
}

export function getRedis(): RedisClient {
  if (!redis?.connected) {
    throw new Error('Redis is not connected')
  }

  return redis
}

export async function createRedisSubscriber(): Promise<RedisClient> {
  const client = getRedis()
  const subscriber = await client.duplicate()

  if (!subscriber.connected) {
    await subscriber.connect()
  }

  return subscriber
}

export async function disconnectRedis(): Promise<void> {
  connectionPromise = undefined

  if (redis) {
    redis.close()
    redis = undefined
  }
}
