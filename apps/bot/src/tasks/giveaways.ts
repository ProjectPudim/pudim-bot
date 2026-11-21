import type { Client } from '@fluxerjs/core'
import { Giveaway, GiveawayParticipant } from '@pudim/database'
import { giveawayManager } from '#bot/managers/giveaway'
import { scheduleManager } from '#bot/managers/schedule'
import { logger } from '#bot/utils/logger'

const TASK_ID = 'giveaways:recover'

export function registerGiveawayTasks(client: Client) {
  if (scheduleManager.has(TASK_ID)) return
  let ready = false
  scheduleManager.every(
    15_000,
    async () => {
      if (!client.isReady()) return
      if (!ready) {
        await Promise.all([Giveaway.init(), GiveawayParticipant.init()])
        ready = true
      }
      await giveawayManager.finishExpired(client)
    },
    {
      id: TASK_ID,
      immediate: true,
      unref: true,
      onError: (error) => logger.error('[Giveaway] task failed', error),
    },
  )
}
