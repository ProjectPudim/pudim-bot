import {
  isCommandFailureError,
  type CommandContext,
  type CommandFailure,
} from '@pudim/framework'

async function safeReply(
  ctx: CommandContext,
  content: string,
  mentionAuthor = false,
): Promise<void> {
  try {
    await ctx.reply({
      content,
      allowedMentions: mentionAuthor
        ? { parse: [], users: [ctx.author.id] }
        : { parse: [] },
    })
  } catch {
    // Ignore reply failures (e.g., when the bot cannot send messages in the channel)
  }
}

async function handleFailure(
  ctx: CommandContext,
  failure: CommandFailure,
): Promise<void> {
  switch (failure.code) {
    case 'COOLDOWN': {
      const seconds = Math.max(1, Math.ceil(failure.retryAfter / 1000))
      await safeReply(
        ctx,
        ctx.t('common.cooldown', `<@${ctx.author.id}>`, seconds),
        true,
      )
      return
    }

    case 'COOLDOWN_UNAVAILABLE': {
      ctx.logger.error('[commands] Cooldown adapter unavailable', failure)
      return
    }

    case 'MISSING_PERMISSIONS': {
      const unique = [...new Set(failure.missing)]
      const formatted = unique.map(
        (permission) => `**${ctx.t(`common.permissions.${permission}`)}**`,
      )
      const list = new Intl.ListFormat(ctx.locale, {
        style: 'long',
        type: 'conjunction',
      }).format(formatted)

      const key =
        failure.target === 'user'
          ? 'common.permissions.messages.user'
          : 'common.permissions.messages.bot'

      await safeReply(ctx, ctx.t(key, list))
      return
    }

    case 'INVALID_CONTEXT': {
      if (failure.expected === 'guild') {
        await safeReply(ctx, ctx.t('common.context.guildOnly'))
      } else if (failure.expected === 'dm') {
        await safeReply(ctx, ctx.t('common.context.dmOnly'))
      }
      return
    }

    case 'CONCURRENCY_LIMIT': {
      await safeReply(ctx, ctx.t('common.context.concurrency'))
      return
    }

    case 'OWNER_ONLY':
    case 'MIDDLEWARE_STOPPED':
    case 'INVALID_ARGUMENTS':
    case 'PARSE_ERROR':
      return
  }
}

export async function handleCommandError(
  ctx: CommandContext,
  error: unknown,
): Promise<void> {
  if (isCommandFailureError(error)) {
    await handleFailure(ctx, error.failure)
    return
  }

  ctx.logger.error(`[commands] Unhandled error in "${ctx.invokedName}"`, error)
}
