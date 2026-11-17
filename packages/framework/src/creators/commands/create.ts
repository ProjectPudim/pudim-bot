import type { EmptyObject } from '../../types'
import type { Command, CommandContext, CommandOptions } from './types'
import { validateCommandOptions } from './validate'

export function createCommand<const TOptions extends object>(
  options: { [K in keyof TOptions]: TOptions[K] } & Omit<
    CommandOptions,
    'run'
  > & {
      run?: (ctx: CommandContext<NoInfer<TOptions>>) => void | Promise<void>
    },
): Command<TOptions>
export function createCommand<const TExtra extends object = EmptyObject>(
  options: CommandOptions<TExtra>,
): Command<TExtra>
export function createCommand<const TExtra extends object = EmptyObject>(
  options: CommandOptions<TExtra>,
): Command<TExtra> {
  const { name, aliases } = validateCommandOptions(options)

  return {
    ...options,
    name,
    aliases,
    hidden: options.hidden ?? false,
    enabled: options.enabled ?? true,
    run:
      options.run ??
      (() => {
        throw new Error(
          `[commands] Command "${name}" has no executor. Provide run() or disable it with enabled: false.`,
        )
      }),
    __isCommand: true,
  } as Command<TExtra>
}
