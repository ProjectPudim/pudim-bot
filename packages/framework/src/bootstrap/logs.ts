import { styleText } from 'node:util'
import { staticPrefixForLogs, type CreatorsRuntime } from '../creators/runtime'
import { logger, style } from '../utils/logger'
import type { RegisteredCounts } from './collect'

export function printLoadLogs(
  runtime: CreatorsRuntime,
  registered: RegisteredCounts,
): void {
  const prefix = staticPrefixForLogs(runtime.config.prefix)
  let previousBlock = false

  if (registered.commands.length > 0) {
    logger.blank()
    logger.line(styleText('dim', 'Commands loaded:'))
    for (const command of registered.commands) {
      const category = (command as { category?: string }).category ?? '-'
      logger.line(
        [
          style(`[${prefix}] Command`, 'green'),
          style('>', 'gray'),
          style(category, 'green'),
          style('>', 'gray'),
          style(command.name, 'blue'),
          style('✓', 'green'),
        ].join(' '),
      )
    }
    previousBlock = true
  }

  if (registered.events.length > 0) {
    if (previousBlock) logger.blank()
    logger.line(styleText('dim', 'Events loaded:'))
    for (const event of registered.events) {
      logger.line(
        [
          style('★ Event', 'yellow'),
          style('>', 'gray'),
          style(event.name, 'yellow', 'underline'),
          style('✓', 'green'),
        ].join(' '),
      )
    }
  }
}
