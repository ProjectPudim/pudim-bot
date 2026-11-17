import { CommandFailureError, setupCreators } from '@pudim/framework'

export const { createCommand, createEvent, createMiddleware } = setupCreators({
  commands: {
    prefix: 'p.',
    async onError(ctx, error) {
      if (
        error instanceof CommandFailureError &&
        error.failure.code === 'COOLDOWN'
      ) {
        const seconds = Math.max(1, Math.ceil(error.failure.retryAfter / 1000))

        await ctx.reply({
          content: ctx.t('common.cooldown', `<@${ctx.author.id}>`, seconds),
          allowedMentions: { users: [ctx.author.id] },
        })
        return
      }

      if (
        error instanceof CommandFailureError &&
        error.failure.code === 'COOLDOWN_UNAVAILABLE'
      ) {
        ctx.logger?.error?.('[commands] Cooldown unavailable', error)
        return
      }

      ctx.logger?.error?.(`[commands] Error in "${ctx.invokedName}"`, error)
    },
  },
})
