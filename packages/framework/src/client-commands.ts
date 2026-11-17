import { Client } from '@fluxerjs/core'
import type { CommandRegistry } from './creators/commands/registry'
import type { CommandInfo } from './creators/commands/types'

declare module '@fluxerjs/core' {
  interface Client {
    readonly commands: CommandInfo[]
  }
}

const registries = new WeakMap<Client, CommandRegistry>()

export function getCommandsInfo(client?: Client): CommandInfo[] {
  if (!client) return []
  return registries.get(client)?.infos() ?? []
}

export function installClientCommands(
  client: Client,
  registry: CommandRegistry,
): void {
  registries.set(client, registry)
  if (Object.getOwnPropertyDescriptor(Client.prototype, 'commands')) return
  Object.defineProperty(Client.prototype, 'commands', {
    configurable: true,
    enumerable: false,
    get(this: Client): CommandInfo[] {
      return getCommandsInfo(this)
    },
  })
}
