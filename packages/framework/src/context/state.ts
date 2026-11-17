import type { CommandStateExtensions } from '../types'

export class CommandState extends Map<string, unknown> {
  override get<K extends string>(
    key: K,
  ): K extends keyof CommandStateExtensions
    ? CommandStateExtensions[K] | undefined
    : unknown {
    return super.get(key) as K extends keyof CommandStateExtensions
      ? CommandStateExtensions[K] | undefined
      : unknown
  }

  override set<K extends string>(
    key: K,
    value: K extends keyof CommandStateExtensions
      ? CommandStateExtensions[K]
      : unknown,
  ): this {
    return super.set(key, value)
  }
}
