import type { Client } from '@fluxerjs/core'
import { isCommand, type AnyCommand } from '../creators/commands/types'
import { attachEvent } from '../creators/events/loader'
import { isEvent, type AnyEvent } from '../creators/events/types'
import type { CreatorsRuntime } from '../creators/runtime'
import { collectModuleValues, type LoadedModule } from '../utils/loader'

export interface RegisteredCounts {
  commands: AnyCommand[]
  events: AnyEvent[]
  ignored: number
}

export function collectExports(imports: LoadedModule[]): RegisteredCounts {
  const registered: RegisteredCounts = {
    commands: [],
    events: [],
    ignored: 0,
  }
  const seen = new Set<unknown>()

  for (const { file, module } of imports) {
    let matched = false

    for (const value of collectModuleValues(module)) {
      if (isCommand(value)) {
        matched = true
        if (seen.has(value)) continue
        seen.add(value)
        registered.commands.push({ ...value, file })
        continue
      }

      if (isEvent(value)) {
        matched = true
        if (seen.has(value)) continue
        seen.add(value)
        registered.events.push({ ...value, file })
      }
    }

    if (!matched) registered.ignored += 1
  }

  return registered
}

export function activate(
  registered: RegisteredCounts,
  runtime: CreatorsRuntime,
  client: Client,
): void {
  runtime.commands.registerAll(registered.commands)

  try {
    runtime.events.registerAll(registered.events)
  } catch (error) {
    for (const command of registered.commands) {
      runtime.commands.unregister(command.name)
    }
    throw error
  }

  try {
    for (const event of registered.events) {
      runtime.events.trackAttachment(event, attachEvent(client, event))
    }
  } catch (error) {
    deactivate(registered, runtime)
    throw error
  }
}

export function deactivate(
  registered: RegisteredCounts,
  runtime: CreatorsRuntime,
): void {
  for (const event of registered.events) {
    runtime.events.unregister(event)
  }
  for (const command of registered.commands) {
    runtime.commands.unregister(command.name)
  }
}
