import { setupCreators } from '@pudim/framework'
import { config } from '#bot/config'
import { handleCommandError } from './error-handler'

export const creators = setupCreators({
  commands: {
    prefix: config.defaultPrefix,
    onError: handleCommandError,
  },
})

export const { createCommand, createEvent, createMiddleware } = creators
