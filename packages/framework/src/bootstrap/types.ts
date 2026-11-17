import type { Client, ClientOptions } from '@fluxerjs/core'
import type { CommandRegistry } from '../creators/commands/registry'
import type { AnyCommandContext } from '../creators/commands/types'
import type { EventRegistry } from '../creators/events/registry'
import type { CreatorsRuntime } from '../creators/runtime'
import type { Creators } from '../creators/setup'
import type { ReloadResult } from '../reload'
import type { CooldownAdapter } from '../utils/cooldown'
import type { LoadedModule } from '../utils/loader'
import type { CoreLogger } from '../utils/logger'

export type BootstrapErrorHandler = (
  error: unknown,
  client: Client,
) => void | Promise<void>

export type ClientFactory<TClient extends Client = Client> = (
  options: ClientOptions,
) => TClient

export interface BootstrapOptions extends Omit<ClientOptions, 'logger'> {
  meta: ImportMeta
  /** Falls back to `BOT_TOKEN` / `FLUXER_BOT_TOKEN` */
  token?: string
  /** Replaces the default `uncaughtException` / `unhandledRejection` handler */
  errorHandler?: BootstrapErrorHandler
  createClient?: ClientFactory
  beforeLoad?(client: Client): Promise<void> | void
  /** Extra glob patterns; prefix with `!` to exclude */
  modules?: string[]
  /** Fully replaces the default glob patterns */
  modulePatterns?: string[]
  /** Receives the core's logs and the SDK's. The SDK level comes from `logLevel` */
  logger?: CoreLogger
  loadLogs?: boolean
  env?: Record<string, unknown>
  ignoreBots?: boolean
  /** Injects global extensions into `ctx` before middlewares and `run` */
  decorateContext?: (ctx: AnyCommandContext) => void | Promise<void>
  /** Application-provided bot owner ids */
  ownerIds?: readonly string[]
  /** Infrastructure adapters */
  adapters?: {
    cooldown?: CooldownAdapter
  }
  /** Cooldown unavailability policy */
  cooldownPolicy?: 'block' | 'allow'
  /** Namespace for cooldown keys */
  namespace?: string
  /** Explicit bot identity for cooldown keys */
  botId?: string
  /** Optional creators runtime returned by setupCreators() */
  creators?: Creators | CreatorsRuntime
}

export type CustomBootstrapOptions<TClient extends Client> = Omit<
  BootstrapOptions,
  'createClient'
> & {
  createClient: ClientFactory<TClient>
}

export interface BootstrapResult<TClient extends Client = Client> {
  client: TClient
  imports: LoadedModule[]
  commands: CommandRegistry
  events: EventRegistry
  reload(): Promise<ReloadResult>
  /** Detaches framework listeners and global handlers; does not disconnect the client */
  dispose(): void
}

const MODULE_EXTENSIONS = '{ts,js,mts,mjs,cts,cjs}'

export const DEFAULT_MODULE_PATTERNS: readonly string[] = [
  `./fluxer/commands/**/*.${MODULE_EXTENSIONS}`,
  `./fluxer/events/**/*.${MODULE_EXTENSIONS}`,
]
