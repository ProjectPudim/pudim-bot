import eightball from './commands/fun/8ball'
import choose from './commands/fun/choose'
import coinflip from './commands/fun/coinflip'
import dice from './commands/fun/dice'
import reverse from './commands/fun/reverse'
import roleplay from './commands/fun/roleplay'
import ship from './commands/fun/ship'
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
import cooldown from './common/cooldown'
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
    roleplay,
    '8ball': eightball,
    choose,
    coinflip,
    dice,
    reverse,
    ship,
  },
  common: { and: 'e', cooldown, permissions, duration, invalid, notFound },
}
