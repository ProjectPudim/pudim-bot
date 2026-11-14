import type { Client } from '@fluxerjs/core'

export interface ReloadResult {
  files: number
  commands: number
  events: number
}

type Reloader = () => Promise<ReloadResult>

const reloaders = new WeakMap<Client, Reloader>()

export function setReloader(
  client: Client,
  reloader: Reloader | undefined,
): void {
  if (reloader) reloaders.set(client, reloader)
  else reloaders.delete(client)
}

/** A failed import or registration keeps the previous commands and events active */
export function reloadModules(client: Client): Promise<ReloadResult> {
  const reloader = reloaders.get(client)
  if (!reloader) {
    return Promise.reject(
      new Error('[reload] This client was not started through bootstrap().'),
    )
  }
  return reloader()
}
