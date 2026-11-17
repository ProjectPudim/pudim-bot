import type { EmptyObject, EventName } from '../../types'
import type { Event, EventOptions } from './types'

export function createEvent<
  K extends EventName,
  const TExtra extends object = EmptyObject,
>(options: EventOptions<K> & TExtra): Event<K, TExtra> {
  if (
    !options ||
    typeof options.name !== 'string' ||
    !options.name.trim() ||
    typeof options.run !== 'function'
  ) {
    throw new Error(
      '[events] An event requires a non-empty name and a run() function.',
    )
  }
  if (options.once !== undefined && typeof options.once !== 'boolean')
    throw new Error(`[events] once for "${options.name}" must be boolean.`)
  return {
    ...options,
    once: options.once ?? false,
    __isEvent: true,
  } satisfies Event<K, TExtra>
}
