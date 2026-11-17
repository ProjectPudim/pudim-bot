import { commandToInfo, type AnyCommand, type CommandInfo } from './types'

export class CommandRegistry {
  readonly #byName = new Map<string, AnyCommand>()
  readonly #byAlias = new Map<string, AnyCommand>()

  register(command: AnyCommand): this {
    const name = command.name
    const origin = command.file ? ` (${command.file})` : ''

    if (this.#byName.has(name) || this.#byAlias.has(name)) {
      throw new Error(
        `[commands] Command "${name}" is already registered${origin}.`,
      )
    }

    for (const alias of command.aliases) {
      if (this.#byName.has(alias) || this.#byAlias.has(alias)) {
        throw new Error(
          `[commands] Alias "${alias}" for command "${name}" is already in use${origin}.`,
        )
      }
    }

    this.#byName.set(name, command)
    for (const alias of command.aliases) this.#byAlias.set(alias, command)

    return this
  }

  /** Validates the whole batch first, so a conflict leaves the registry untouched */
  registerAll(commands: Iterable<AnyCommand>): this {
    const batch = [...commands]
    const names = new Set([...this.#byName.keys(), ...this.#byAlias.keys()])
    for (const command of batch) {
      for (const name of [command.name, ...command.aliases]) {
        if (names.has(name))
          throw new Error(
            `[commands] Name or alias "${name}" is already in use${command.file ? ` (${command.file})` : ''}.`,
          )
        names.add(name)
      }
    }
    for (const command of batch) this.register(command)
    return this
  }

  unregister(nameOrAlias: string): boolean {
    const key = nameOrAlias.trim().toLowerCase()
    const command = this.#byName.get(key) ?? this.#byAlias.get(key)
    if (!command) return false

    this.#byName.delete(command.name)
    for (const alias of command.aliases) this.#byAlias.delete(alias)
    return true
  }

  get(nameOrAlias: string): AnyCommand | undefined {
    const key = nameOrAlias.trim().toLowerCase()
    return this.#byName.get(key) ?? this.#byAlias.get(key)
  }

  has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== undefined
  }

  all(): AnyCommand[] {
    return [...this.#byName.values()]
  }

  infos(): CommandInfo[] {
    return this.all().map(commandToInfo)
  }

  visible(): AnyCommand[] {
    return this.all().filter((command) => !command.hidden)
  }

  get size(): number {
    return this.#byName.size
  }

  clear(): void {
    this.#byName.clear()
    this.#byAlias.clear()
  }
}
