import { createEvent } from '#bot/fluxer'
import { registerGiveawayTasks } from '#bot/tasks/giveaways'

export default createEvent({
  name: 'ready',
  run(client) {
    registerGiveawayTasks(client)
  },
})
