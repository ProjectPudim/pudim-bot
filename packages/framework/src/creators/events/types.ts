import type {
  EmptyObject,
  EventArgs,
  EventName,
  EventOptionsExtensions,
} from '../../types'

export type EventErrorHandler = (
  event: AnyEvent,
  error: unknown,
) => void | Promise<void>

export interface BaseEventOptions<K extends EventName = EventName> {
  name: K
  once?: boolean
  run: (...args: EventArgs<K>) => Promise<void> | void
}

export interface EventOptions<K extends EventName = EventName>
  extends BaseEventOptions<K>, EventExtensions, EventOptionsExtensions {}

export interface EventBase<K extends EventName = EventName> {
  readonly name: K
  readonly once: boolean
  readonly file?: string
  readonly __isEvent: true
  run: (...args: EventArgs<K>) => Promise<void> | void
}

export type Event<
  K extends EventName = EventName,
  TExtra extends object = EmptyObject,
> = EventBase<K> & TExtra & EventExtensions & EventOptionsExtensions

export type AnyEvent = Omit<EventBase, 'name' | 'run'> & {
  name: string
  run: (...args: never[]) => Promise<void> | void
} & EventExtensions &
  EventOptionsExtensions

export function isEvent(value: unknown): value is AnyEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__isEvent' in value &&
    value.__isEvent === true &&
    'name' in value &&
    typeof value.name === 'string' &&
    'run' in value &&
    typeof value.run === 'function'
  )
}
