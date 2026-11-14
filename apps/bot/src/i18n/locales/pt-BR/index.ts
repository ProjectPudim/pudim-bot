import avatar from './commands/utility/avatar'
import botinfo from './commands/utility/botinfo'
import help from './commands/utility/help'
import permissions from './common/permissions'

export default {
  commands: { help, avatar, botinfo },
  common: { permissions },
}
