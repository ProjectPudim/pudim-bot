import type { ReactionProcess } from './types'

export const DEFAULT_COOLDOWN_MS = 1_000
export const MAX_QUEUED = 10

const busy = new Map<string, number>()
const queues = new Map<string, Promise<void>>()
const recentClicks = new Map<string, number>()

export function checkAndRecordClickCooldown(
  key: string,
  cooldownMs = DEFAULT_COOLDOWN_MS,
): boolean {
  const now = Date.now()
  if (now - (recentClicks.get(key) ?? 0) < cooldownMs) {
    return false
  }

  recentClicks.set(key, now)
  if (recentClicks.size > 1_000) {
    const cutoff = now - 60_000
    for (const [k, at] of recentClicks) {
      if (at < cutoff) recentClicks.delete(k)
    }
  }

  return true
}

function enqueue(lockKey: string, task: () => Promise<void>): Promise<void> {
  const previous = queues.get(lockKey) ?? Promise.resolve()
  const result = previous.then(task)
  const tail = result.catch(() => {})
  queues.set(lockKey, tail)
  void tail.then(() => {
    if (queues.get(lockKey) === tail) queues.delete(lockKey)
  })
  return result
}

export async function runWithReactionLock(
  lockKey: string,
  mode: ReactionProcess,
  maxQueued: number,
  task: () => Promise<void>,
): Promise<boolean> {
  const depth = busy.get(lockKey) ?? 0
  if (mode === 'single' ? depth > 0 : depth >= maxQueued) {
    return false
  }

  busy.set(lockKey, depth + 1)
  try {
    if (mode === 'multiple') await enqueue(lockKey, task)
    else await task()
  } finally {
    const left = (busy.get(lockKey) ?? 1) - 1
    if (left <= 0) busy.delete(lockKey)
    else busy.set(lockKey, left)
  }

  return true
}
