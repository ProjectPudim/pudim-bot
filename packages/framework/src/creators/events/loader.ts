import type { Client } from '@fluxerjs/core'
import {
  collectModuleValues,
  discoverFiles,
  importModule,
  type DiscoverFilesOptions,
} from '../../utils/loader'
import { logger } from '../../utils/logger'
import { ensureCreatorsRuntime } from '../runtime'
import type { EventRegistry } from './registry'
import { isEvent, type AnyEvent } from './types'

export interface LoadEventsOptions extends DiscoverFilesOptions {
  directory: string
  client: Client
  registry?: EventRegistry
  onError?: (error: unknown, filePath: string) => void | Promise<void>
}

const attachments = new WeakMap<Client, Map<AnyEvent, () => void>>()

export function attachEvent(client: Client, event: AnyEvent): () => void {
  let bindings = attachments.get(client)
  if (!bindings) {
    bindings = new Map()
    attachments.set(client, bindings)
  }
  const existing = bindings.get(event)
  if (existing) return existing
  // The event name and SDK argument tuple are correlated at createEvent()
  const run = event.run as (...args: unknown[]) => Promise<void> | void

  const listener = async (...args: unknown[]): Promise<void> => {
    if (event.once) bindings.delete(event)
    try {
      await run(client, ...args)
    } catch (error) {
      const handler = ensureCreatorsRuntime().config.onEventError
      if (handler) {
        try {
          await handler(event, error)
        } catch (handlerError) {
          logger.error(
            `[events] Error handler failed for "${event.name}"`,
            handlerError,
          )
        }
      } else {
        logger.error(`[events] Error in listener "${event.name}"`, error)
      }
    }
  }

  const dispose = () => {
    client.off(event.name, listener)
    if (bindings.get(event) === dispose) bindings.delete(event)
  }
  if (event.once) {
    client.once(event.name, listener)
  } else {
    client.on(event.name, listener)
  }
  bindings.set(event, dispose)
  return dispose
}

export function attachEvents(
  client: Client,
  events: Iterable<AnyEvent>,
): () => void {
  const disposers = [...events].map((event) => attachEvent(client, event))
  return () => {
    for (const dispose of disposers) dispose()
  }
}

export async function loadEvents(
  options: LoadEventsOptions,
): Promise<AnyEvent[]> {
  const files = await discoverFiles(options.directory, options)
  const loaded: AnyEvent[] = []
  const seen = new Set<unknown>()

  for (const file of files) {
    let registered: AnyEvent[] = []
    const disposers: (() => void)[] = []
    try {
      const namespace = await importModule(file)

      const events = collectModuleValues(namespace)
        .filter(isEvent)
        .filter((value) => {
          if (seen.has(value)) return false
          seen.add(value)
          return true
        })
        .map((value) => ({ ...value, file }))
      options.registry?.registerAll(events)
      registered = events
      for (const event of events) {
        const dispose = attachEvent(options.client, event)
        disposers.push(dispose)
        options.registry?.trackAttachment(event, dispose)
      }
      loaded.push(...events)
    } catch (error) {
      for (const dispose of disposers) dispose()
      for (const event of registered) options.registry?.unregister(event)
      if (options.onError) {
        await options.onError(error, file)
        continue
      }
      throw error
    }
  }

  return loaded
}
