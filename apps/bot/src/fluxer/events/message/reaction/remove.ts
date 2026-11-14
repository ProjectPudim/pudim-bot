import { createEvent } from '#bot/fluxer'
import { reactionManager } from '#bot/managers'

export default createEvent({
  name: 'messageReactionRemove',
  async run(client, payload) {
    await reactionManager.removeHandler(payload, client)
  },
})
