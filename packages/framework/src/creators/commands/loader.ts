import {
  collectModuleValues,
  discoverFiles,
  importModule,
  type DiscoverFilesOptions,
} from '../../utils/loader'
import type { CommandRegistry } from './registry'
import { isCommand, type AnyCommand } from './types'

export interface LoadCommandsOptions extends DiscoverFilesOptions {
  directory: string
  registry: CommandRegistry
  onError?: (error: unknown, filePath: string) => void | Promise<void>
}

export async function loadCommands(
  options: LoadCommandsOptions,
): Promise<AnyCommand[]> {
  const files = await discoverFiles(options.directory, options)
  const loaded: AnyCommand[] = []
  const seen = new Set<unknown>()

  for (const file of files) {
    try {
      const namespace = await importModule(file)

      const commands = collectModuleValues(namespace)
        .filter(isCommand)
        .filter((value) => {
          if (seen.has(value)) return false
          seen.add(value)
          return true
        })
        .map((value) => ({ ...value, file }))
      options.registry.registerAll(commands)
      loaded.push(...commands)
    } catch (error) {
      if (options.onError) {
        await options.onError(error, file)
        continue
      }
      throw error
    }
  }

  return loaded
}
