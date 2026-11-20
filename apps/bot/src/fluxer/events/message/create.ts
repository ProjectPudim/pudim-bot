import { createEvent } from '#bot/fluxer'
import { autoReactionManager } from '#bot/managers'

export default createEvent({
  name: 'messageCreate',
  async run(_client, message) {
    void autoReactionManager.processMessage(message)
  },
})
