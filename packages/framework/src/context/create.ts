import type { Client, Guild, GuildMember, Message } from '@fluxerjs/core'
import { getCommandsInfo } from '../client-commands'
import type { CommandRegistry } from '../creators/commands/registry'
import type {
  AnyCommand,
  Command,
  CommandContext,
  CommandNotFoundContext,
  InvocationContext,
} from '../creators/commands/types'
import type { EmptyObject } from '../types'
import { CommandState } from './state'

export interface InvocationContextInput {
  client: Client
  message: Message
  args: string[]
  rawArgs: string
  prefix: string
  invokedName?: string
  registry?: CommandRegistry
}

export interface CreateContextInput<
  TExtra extends object = EmptyObject,
> extends InvocationContextInput {
  command: Command<TExtra>
}

function createInvocationContext<C extends AnyCommand | undefined>(
  input: InvocationContextInput,
  command: C,
): InvocationContext & { readonly command: C } {
  const { client, message, args, rawArgs, prefix } = input
  let guildRequest: ReturnType<Message['resolveGuild']> | undefined
  let memberRequest: Promise<GuildMember | null> | undefined
  let resolvedMember: GuildMember | null = null
  let resolvedGuild: Guild | null = null
  const resolveGuild = () =>
    (guildRequest ??= message.resolveGuild().then((guild) => {
      resolvedGuild = guild
      return guild
    }))
  const resolveMember = () =>
    (memberRequest ??= (async () => {
      if (message.member) return message.member
      if (!message.guildId) return null
      const guild = message.guild ?? (await resolveGuild())
      if (!guild) return null
      resolvedMember = await guild.members.resolve(message.author.id)
      return resolvedMember
    })().catch(() => null))

  // Required declaration-merged properties are populated by decorateContext before dispatch
  return {
    client,
    message,
    command,
    get author() {
      return message.author
    },
    get member() {
      return message.member ?? resolvedMember
    },
    get guild() {
      return message.guild ?? resolvedGuild
    },
    get channel() {
      return message.channel
    },
    channelId: message.channelId,
    guildId: message.guildId,
    args,
    rawArgs,
    prefix,
    invokedName: input.invokedName ?? command?.name ?? '',
    commandName: command?.name ?? input.invokedName?.toLowerCase() ?? '',
    state: new CommandState(),
    reply: message.reply.bind(message),
    send: message.send.bind(message),
    resolveGuild,
    resolveMember,
    hasPermission: async (permission) => {
      const member = message.member ?? (await resolveMember())
      return member?.permissions.has(permission) ?? false
    },
    get commands() {
      return input.registry?.infos() ?? getCommandsInfo(client)
    },
  } as InvocationContext & { readonly command: C }
}

export function createContext<TExtra extends object = EmptyObject>(
  input: CreateContextInput<TExtra>,
): CommandContext<TExtra> {
  return createInvocationContext(input, input.command)
}

export function createNotFoundContext(
  input: InvocationContextInput,
): CommandNotFoundContext {
  return createInvocationContext(input, undefined)
}
