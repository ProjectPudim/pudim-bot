import { Category } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import {
  ticketActionManager,
  ticketConfigManager,
  ticketOptionManager,
  ticketPanelManager,
} from '#bot/managers'
import { runTicketCommand } from '#bot/managers/ticket/helpers'
import { replyUsage, TICKET_USAGE } from '#bot/managers/ticket/usage'

const USAGE = TICKET_USAGE

const CLOSE_SETTINGS = new Set(['action', 'delay', 'emoji', 'opener', 'dm'])

export default createCommand({
  name: 'ticket',
  description: 'Configures the ticket system.',
  descriptionLocalizations: {
    'pt-BR': 'Configura o sistema de tickets.',
    'es-ES': 'Configura el sistema de tickets.',
  },
  category: Category.Settings,
  usage: USAGE,
  context: 'guild',
  userPermissions: 'ManageGuild',
  async run(ctx) {
    if (ctx.args.length === 0) {
      await replyUsage(ctx)
      return
    }
    await runTicketCommand(ctx, async () => {
      const [sub, ...rest] = ctx.args
      const command = sub?.toLowerCase()

      switch (command) {
        case 'channel':
        case 'category':
        case 'staffrole':
        case 'logchannel':
        case 'namepattern':
        case 'welcome':
        case 'blacklist':
        case 'config':
          await ticketConfigManager.command(ctx)
          return

        case 'close':
          if (CLOSE_SETTINGS.has(rest[0]?.toLowerCase() ?? '')) {
            await ticketConfigManager.command(ctx)
            return
          }
          await ticketActionManager.close(ctx)
          return

        case 'panel':
          await ticketPanelManager.command(ctx)
          return

        case 'option':
          await ticketOptionManager.command(ctx)
          return

        case 'reopen':
          await ticketActionManager.reopen(ctx)
          return

        case 'add':
          await ticketActionManager.add(ctx)
          return

        case 'remove':
          await ticketActionManager.remove(ctx)
          return

        case 'transfer':
          await ticketActionManager.transfer(ctx)
          return

        default:
          await replyUsage(ctx)
      }
    })
  },
})
