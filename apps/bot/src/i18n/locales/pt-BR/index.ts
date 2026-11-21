import { config, emojis } from '#bot/config'
import eightball from './commands/fun/8ball'
import choose from './commands/fun/choose'
import coinflip from './commands/fun/coinflip'
import dice from './commands/fun/dice'
import reverse from './commands/fun/reverse'
import roleplay from './commands/fun/roleplay'
import ship from './commands/fun/ship'
import autoreaction from './commands/settings/autoreaction'
import autorole from './commands/settings/autorole'
import reactionroles from './commands/settings/reactionroles'
import ticket from './commands/settings/ticket'
import avatar from './commands/utility/avatar'
import botinfo from './commands/utility/botinfo'
import botinvite from './commands/utility/botinvite'
import channelinfo from './commands/utility/channelinfo'
import emojiinfo from './commands/utility/emojiinfo'
import help from './commands/utility/help'
import inviteinfo from './commands/utility/inviteinfo'
import ping from './commands/utility/ping'
import roleinfo from './commands/utility/roleinfo'
import serverbanner from './commands/utility/serverbanner'
import servericon from './commands/utility/servericon'
import serverinfo from './commands/utility/serverinfo'
import userbanner from './commands/utility/userbanner'
import userinfo from './commands/utility/userinfo'
import context from './common/context'
import cooldown from './common/cooldown'
import duration from './common/duration'
import invalid from './common/invalid'
import notFound from './common/notFound'
import permissions from './common/permissions'
import errors from './errors'

export default {
  commands: {
    ticket,
    help,
    ping,
    autoreaction,
    reactionroles,
    avatar,
    botinfo,
    botinvite,
    channelinfo,
    emojiinfo,
    inviteinfo,
    roleinfo,
    autorole,
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
  common: {
    and: 'e',
    context,
    cooldown,
    permissions,
    duration,
    invalid,
    notFound,
    invalidCommandUsage: (usage: string | string[], prefix?: string) => {
      const lines = (Array.isArray(usage) ? usage : usage.split(/\r?\n/))
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) =>
          prefix === undefined ? line : line.replaceAll('{prefix}', prefix),
        )

      return `Você utilizou esse comando de forma incorreta! Por favor, siga o padrão abaixo:\n${lines
        .map((line) => `- \`${line}\``)
        .join('\n')}`
    },
    invalidMessageId: `${config.separator(emojis.error)} O link ou ID da mensagem informado é inválido. Por favor, tente novamente com um link ou ID válido.`,
    invalidEmoji: `${config.separator(emojis.error)} O emoji que você informou é inválido. Por favor, tente novamente com um emoji válido.`,
    invalidRole: `${config.separator(emojis.error)} O cargo ou ID do cargo que você informou é inválido. Por favor, tente novamente com um cargo válido.`,
  },
  errors,
}
