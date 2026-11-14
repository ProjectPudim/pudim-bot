import type { Client, ClientEvents } from '@fluxerjs/core'

export type EmptyObject = Record<never, never>

export type EventName = keyof ClientEvents

export type EventArgs<K extends EventName = EventName> = [
  client: Client,
  ...args: ClientEvents[K],
]

export type LocalizationMap = Record<string, string>

/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface CommandContextExtensions {}
export interface CommandOptionsExtensions {}
export interface CommandStateExtensions {}
export interface CommandMetadata {}
export interface EventOptionsExtensions {}
export interface FrameworkTypeConfig {}
/* eslint-enable @typescript-eslint/no-empty-object-type */

// Extend these via `declare global` in a `.d.ts` file,
// e.g. `interface CommandExtensions { category: string }`.

/* eslint-disable @typescript-eslint/no-empty-object-type */
declare global {
  interface ContextExtensions {}
  interface CommandExtensions {}
  interface EventExtensions {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type */
