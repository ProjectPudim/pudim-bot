import avatar from './commands/utility/avatar'
import botinfo from './commands/utility/botinfo'
import botinvite from './commands/utility/botinvite'
import channelinfo from './commands/utility/channelinfo'
import help from './commands/utility/help'
import duration from './common/duration'
import permissions from './common/permissions'

export default {
  commands: { help, avatar, botinfo, botinvite, channelinfo },
  common: { and: 'e', permissions, duration },
}
