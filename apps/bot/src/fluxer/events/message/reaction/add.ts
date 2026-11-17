import { createEvent } from '#bot/fluxer'
import { reactionManager } from '#bot/managers'

export default createEvent({
  name: 'messageReactionAdd',
  async run(client, payload) {
    await reactionManager.handler(payload, client)
  },
})
