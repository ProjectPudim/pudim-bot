import avatar from './commands/utility/avatar'
import botinfo from './commands/utility/botinfo'
import botinvite from './commands/utility/botinvite'
import channelinfo from './commands/utility/channelinfo'
import emojiinfo from './commands/utility/emojiinfo'
import help from './commands/utility/help'
import inviteinfo from './commands/utility/inviteinfo'
import roleinfo from './commands/utility/roleinfo'
import serverbanner from './commands/utility/serverbanner'
import servericon from './commands/utility/servericon'
import serverinfo from './commands/utility/serverinfo'
import userbanner from './commands/utility/userbanner'
import userinfo from './commands/utility/userinfo'
import duration from './common/duration'
import invalid from './common/invalid'
import notFound from './common/notFound'
import permissions from './common/permissions'

export default {
  commands: {
    help,
    avatar,
    botinfo,
    botinvite,
    channelinfo,
    emojiinfo,
    inviteinfo,
    roleinfo,
    serverbanner,
    servericon,
    serverinfo,
    userbanner,
    userinfo,
  },
  common: { and: 'e', permissions, duration, invalid, notFound },
}
