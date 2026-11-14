import { getRedis } from './client'

export async function cacheGet<T>(key: string): Promise<T | null> {
  const value = await getRedis().get(key)

  if (value === null) {
    return null
  }

  return JSON.parse(value) as T
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttl: number,
): Promise<void> {
  await getRedis().set(key, JSON.stringify(value), 'EX', ttl)
}

export async function cacheDel(key: string): Promise<void> {
  await getRedis().del(key)
}

export async function cached<T>(
  key: string,
  ttl: number,
  callback: () => Promise<T>,
): Promise<T> {
  const value = await cacheGet<T>(key)

  if (value !== null) {
    return value
  }

  const result = await callback()

  await cacheSet(key, result, ttl)

  return result
}
