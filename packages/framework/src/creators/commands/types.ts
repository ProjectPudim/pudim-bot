import type {
  Client,
  GuildMember,
  Message,
  PermissionResolvable,
} from '@fluxerjs/core'
import type { CommandState } from '../../context/state'
import type {
  CommandContextExtensions,
  CommandMetadata,
  CommandOptionsExtensions,
  EmptyObject,
  FrameworkTypeConfig,
  LocalizationMap,
} from '../../types'
import type { ParsedCommandArgs } from '../../utils/args'
import type { ConcurrencyOptions } from '../../utils/concurrency'
import type { CooldownOptions } from '../../utils/cooldown'
import type { StandardSchemaV1 } from '../../utils/standard-schema'
import type { HandleCommandResult } from './handle'
import type { Middlewares, MiddlewareStopError } from './middleware'

export type PrefixValue = string | readonly string[] | null | undefined
export type PrefixResolver =
  PrefixValue | ((message: Message) => PrefixValue | Promise<PrefixValue>)

export type CommandErrorHandler = (
  ctx: CommandContext,
  error: unknown,
) => void | Promise<void>
export type CommandNotFoundHandler = (
  ctx: CommandNotFoundContext,
) => void | Promise<void>
export type CommandNotFoundErrorHandler = (
  ctx: CommandNotFoundContext,
  error: unknown,
) => void | Promise<void>
export type MiddlewareStopHandler = (
  ctx: CommandContext,
  stop: MiddlewareStopError,
) => void | Promise<void>

export interface CommandHooks {
  before?: (ctx: CommandContext) => void | Promise<void>
  success?: (
    ctx: CommandContext,
    info: { duration: number; result: HandleCommandResult },
  ) => void | Promise<void>
  failure?: (
    ctx: CommandContext,
    error: unknown,
    info: { duration: number; result: HandleCommandResult },
  ) => void | Promise<void>
  finally?: (
    ctx: CommandContext,
    info: { duration: number; result: HandleCommandResult },
  ) => void | Promise<void>
}

export interface BaseCommandOptions {
  name: string
  description: string
  nameLocalizations?: LocalizationMap
  descriptionLocalizations?: LocalizationMap
  aliases?: readonly string[]
  hidden?: boolean
  enabled?: boolean
  metadata?: CommandMetadata
  context?: 'guild' | 'dm' | 'both'
  ownerOnly?: boolean
  ownerIds?: readonly string[]
  userPermissions?: PermissionResolvable
  botPermissions?: PermissionResolvable
  cooldown?: number | CooldownOptions
  concurrency?: number | ConcurrencyOptions
  parseArgs?: boolean
  argsSchema?: StandardSchemaV1
  hooks?: CommandHooks
  /** Run after the global middlewares */
  middlewares?: Middlewares
  run?: (ctx: CommandContext) => void | Promise<void>
}

type ExtensionOptions = Partial<
  Omit<CommandExtensions & CommandOptionsExtensions, keyof BaseCommandOptions>
>
type ConfigurableOptions = Omit<
  BaseCommandOptions,
  'name' | 'description' | 'run'
> &
  ExtensionOptions
type RequiredKeys = FrameworkTypeConfig extends {
  requiredCommandOptions: infer Keys
}
  ? Extract<Keys, keyof ConfigurableOptions>
  : never

export type CommandOptions<TExtra extends object = EmptyObject> = Pick<
  BaseCommandOptions,
  'name' | 'description'
> &
  ConfigurableOptions &
  Required<Pick<ConfigurableOptions, RequiredKeys>> &
  TExtra & {
    run?: (ctx: CommandContext<NoInfer<TExtra>>) => void | Promise<void>
  }

export interface InvocationContext
  extends ContextExtensions, CommandContextExtensions {
  readonly client: Client
  readonly message: Message
  readonly author: Message['author']
  readonly member: Message['member']
  readonly guild: Message['guild']
  readonly channel: Message['channel']
  readonly channelId: Message['channelId']
  readonly guildId: Message['guildId']
  readonly args: string[]
  readonly rawArgs: string
  readonly parsedArgs?: ParsedCommandArgs
  readonly validated?: unknown
  readonly prefix: string
  readonly commandName: string
  readonly invokedName: string
  readonly state: CommandState
  reply: Message['reply']
  send: Message['send']
  resolveGuild: Message['resolveGuild']
  resolveMember(): Promise<GuildMember | null>
  hasPermission(permission: PermissionResolvable): Promise<boolean>
  readonly commands: CommandInfo[]
}

export interface CommandContext<
  TExtra extends object = EmptyObject,
> extends InvocationContext {
  readonly command: Command<TExtra>
  readonly validated: TExtra extends {
    argsSchema: infer Schema extends StandardSchemaV1
  }
    ? StandardSchemaV1.InferOutput<Schema>
    : unknown
}

export interface CommandNotFoundContext extends InvocationContext {
  readonly command: undefined
}

export type AnyCommandContext = CommandContext | CommandNotFoundContext

type Whitespace =
  | ' '
  | '\t'
  | '\n'
  | '\r'
  | '\v'
  | '\f'
  | '\u00a0'
  | '\ufeff'
  | '\u1680'
  | '\u2000'
  | '\u2001'
  | '\u2002'
  | '\u2003'
  | '\u2004'
  | '\u2005'
  | '\u2006'
  | '\u2007'
  | '\u2008'
  | '\u2009'
  | '\u200a'
  | '\u2028'
  | '\u2029'
  | '\u202f'
  | '\u205f'
  | '\u3000'
type Trim<S extends string> = S extends `${Whitespace}${infer R}`
  ? Trim<R>
  : S extends `${infer R}${Whitespace}`
    ? Trim<R>
    : S
export type NormalizedCommandName<T> = T extends {
  name: infer Name extends string
}
  ? Lowercase<Trim<Name>>
  : string

export interface CommandBase<TExtra extends object = EmptyObject> {
  readonly name: NormalizedCommandName<TExtra>
  readonly description: TExtra extends {
    description: infer Description extends string
  }
    ? Description
    : string
  readonly nameLocalizations?: LocalizationMap
  readonly descriptionLocalizations?: LocalizationMap
  readonly aliases: readonly string[]
  readonly hidden: boolean
  readonly enabled: boolean
  readonly metadata?: TExtra extends {
    metadata: infer Metadata extends CommandMetadata
  }
    ? Metadata
    : CommandMetadata
  readonly context?: 'guild' | 'dm' | 'both'
  readonly ownerOnly?: boolean
  readonly ownerIds?: readonly string[]
  readonly userPermissions?: PermissionResolvable
  readonly botPermissions?: PermissionResolvable
  readonly cooldown?: number | CooldownOptions
  readonly concurrency?: number | ConcurrencyOptions
  readonly parseArgs?: boolean
  readonly argsSchema?: StandardSchemaV1
  readonly hooks?: CommandHooks
  readonly middlewares?: Middlewares
  readonly file?: string
  readonly __isCommand: true
  run(ctx: CommandContext<TExtra>): void | Promise<void>
}

export type Command<TExtra extends object = EmptyObject> = CommandBase<TExtra> &
  Omit<TExtra, keyof CommandBase> &
  ExtensionOptions
export type AnyCommand = Command
export type CommandInfo = Omit<
  AnyCommand,
  'run' | '__isCommand' | 'middlewares' | 'argsSchema' | 'hooks'
> & {
  readonly cooldown?: { duration: number; scope: string }
  readonly concurrency?: { limit: number; scope: string }
}

export function commandToInfo(command: AnyCommand): CommandInfo {
  /* eslint-disable @typescript-eslint/no-unused-vars -- Omit executable fields from public command metadata. */
  const {
    run: _run,
    __isCommand: _brand,
    middlewares: _middlewares,
    argsSchema: _argsSchema,
    hooks: _hooks,
    ...rest
  } = command
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const cooldown =
    typeof rest.cooldown === 'number'
      ? { duration: rest.cooldown, scope: 'user' as const }
      : rest.cooldown
        ? {
            duration: rest.cooldown.duration,
            scope: rest.cooldown.scope ?? 'user',
          }
        : undefined
  const concurrency =
    typeof rest.concurrency === 'number'
      ? { limit: rest.concurrency, scope: 'user' as const }
      : rest.concurrency
        ? {
            limit: rest.concurrency.limit,
            scope: rest.concurrency.scope ?? 'user',
          }
        : undefined
  return {
    ...rest,
    cooldown,
    concurrency,
  } as CommandInfo
}

export function isCommand(value: unknown): value is AnyCommand {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__isCommand' in value &&
    value.__isCommand === true &&
    'name' in value &&
    typeof value.name === 'string' &&
    'description' in value &&
    typeof value.description === 'string' &&
    'aliases' in value &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias: unknown) => typeof alias === 'string') &&
    'run' in value &&
    typeof value.run === 'function'
  )
}
