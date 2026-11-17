import { Client } from '@fluxerjs/core'
import type { CommandRegistry } from './creators/commands/registry'
import type { CommandInfo } from './creators/commands/types'
import { ensureCreatorsRuntime } from './creators/runtime'

declare module '@fluxerjs/core' {
  interface Client {
    readonly commands: CommandInfo[]
  }
}

const registries = new WeakMap<Client, CommandRegistry>()

export function getCommandsInfo(client?: Client): CommandInfo[] {
  return (
    (client ? registries.get(client) : undefined)?.infos() ??
    ensureCreatorsRuntime().commands.infos()
  )
}

export function installClientCommands(
  client?: Client,
  registry?: CommandRegistry,
): void {
  if (client && registry) registries.set(client, registry)
  if (Object.getOwnPropertyDescriptor(Client.prototype, 'commands')) return
  Object.defineProperty(Client.prototype, 'commands', {
    configurable: true,
    enumerable: false,
    get(this: Client): CommandInfo[] {
      return getCommandsInfo(this)
    },
  })
}

installClientCommands()
