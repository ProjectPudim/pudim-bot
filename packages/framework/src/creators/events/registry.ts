import type { AnyEvent } from './types'

export class EventRegistry {
  readonly #events: AnyEvent[] = []
  readonly #byEventName = new Map<string, AnyEvent[]>()
  readonly #disposers = new Map<AnyEvent, Set<() => void>>()

  register(event: AnyEvent): this {
    if (
      (this.#byEventName.get(event.name) ?? []).some(
        (existing) =>
          existing === event ||
          (existing.run === event.run && existing.file === event.file),
      )
    ) {
      throw new Error(
        `[events] Listener "${event.name}" is already registered${event.file ? ` (${event.file})` : ''}.`,
      )
    }
    this.#events.push(event)

    const list = this.#byEventName.get(event.name) ?? []
    list.push(event)
    this.#byEventName.set(event.name, list)

    return this
  }

  registerAll(events: Iterable<AnyEvent>): this {
    const batch = [...events]
    const staged = new EventRegistry()
    for (const event of [...this.#events, ...batch]) staged.register(event)
    for (const event of batch) this.register(event)
    return this
  }

  trackAttachment(event: AnyEvent, dispose: () => void): void {
    const disposers = this.#disposers.get(event) ?? new Set<() => void>()
    disposers.add(dispose)
    this.#disposers.set(event, disposers)
  }

  unregister(event: AnyEvent): boolean {
    const index = this.#events.indexOf(event)
    if (index === -1) return false
    for (const dispose of this.#disposers.get(event) ?? []) dispose()
    this.#disposers.delete(event)

    this.#events.splice(index, 1)
    const list = this.#byEventName.get(event.name)
    if (list) {
      const listIndex = list.indexOf(event)
      if (listIndex !== -1) list.splice(listIndex, 1)
      if (list.length === 0) this.#byEventName.delete(event.name)
    }
    return true
  }

  get(name: string): AnyEvent | undefined {
    const key = name.trim().toLowerCase()
    return this.#events.find((event) => event.name.toLowerCase() === key)
  }

  byEventName(eventName: string): AnyEvent[] {
    return [...(this.#byEventName.get(eventName) ?? [])]
  }

  all(): AnyEvent[] {
    return [...this.#events]
  }

  get size(): number {
    return this.#events.length
  }

  clear(): void {
    for (const disposers of this.#disposers.values())
      for (const dispose of disposers) dispose()
    this.#disposers.clear()
    this.#events.length = 0
    this.#byEventName.clear()
  }
}
