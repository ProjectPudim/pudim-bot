import { Events, type Client, type Message } from '@fluxerjs/core'
import { handleCommand } from '../creators/commands/handle'
import type { AnyCommandContext } from '../creators/commands/types'
import type { CreatorsRuntime } from '../creators/runtime'
import type { CooldownAdapter } from '../utils/cooldown'
import { logger } from '../utils/logger'

const commandPipelines = new WeakMap<Client, () => void>()

export interface AttachPipelineOptions {
  ignoreBots?: boolean
  decorateContext?: (ctx: AnyCommandContext) => void | Promise<void>
  showLogs?: boolean
  ownerIds?: readonly string[]
  cooldownAdapter?: CooldownAdapter
  cooldownPolicy?: 'block' | 'allow'
  botId?: string
}

export function attachCommandPipeline(
  client: Client,
  runtime: CreatorsRuntime,
  options: AttachPipelineOptions,
): () => void {
  commandPipelines.get(client)?.()

  if (
    !runtime.config.prefix &&
    runtime.commands.size > 0 &&
    (options.showLogs ?? true)
  ) {
    logger.warn(
      `${runtime.commands.size} command(s) registered, but NO prefix was defined — ` +
        `command pipeline DISABLED. Set one in ` +
        `setupCreators({ commands: { prefix: '!' } }).`,
    )
  }

  const listener = (message: Message) => {
    const prefix = runtime.config.prefix
    if (!prefix) return

    void handleCommand(client, message, {
      registry: runtime.commands,
      prefix,
      ignoreBots: options.ignoreBots,
      decorateContext: options.decorateContext,
      middlewares: runtime.config.middlewares,
      onError: runtime.config.onCommandError,
      onMiddlewareStop: runtime.config.onMiddlewareStop,
      notFound: runtime.config.notFound,
      onNotFoundError: runtime.config.onNotFoundError,
      ownerIds: options.ownerIds ?? runtime.config.ownerIds,
      hooks: runtime.config.hooks,
      logger: runtime.config.logger,
      cooldownAdapter: options.cooldownAdapter,
      cooldownPolicy: options.cooldownPolicy,
      botIdentity: options.botId ?? client.user?.id,
    }).catch((error: unknown) => {
      logger.error('[bootstrap] Command pipeline failed', error)
    })
  }

  client.on(Events.MessageCreate, listener)

  const dispose = () => {
    client.off(Events.MessageCreate, listener)
    if (commandPipelines.get(client) === dispose) {
      commandPipelines.delete(client)
    }
  }

  commandPipelines.set(client, dispose)
  return dispose
}
