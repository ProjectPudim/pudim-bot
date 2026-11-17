import type { Client } from '@fluxerjs/core'

export interface BotStats {
  guilds: number
  users: number
  memoryMb: number
  ping: number
  status: 'online' | 'connecting'
}

const BYTES_PER_MB = 1024 * 1024

/** Metrics for the current client instance */
export function getBotStats(client: Client): BotStats {
  return {
    guilds: client.guilds.size,
    users: client.guilds.reduce(
      (total, guild) => total + (guild.memberCount ?? 0),
      0,
    ),
    memoryMb: process.memoryUsage().rss / BYTES_PER_MB,
    ping: client.ws.ping,
    status: client.isReady() ? 'online' : 'connecting',
  }
}
