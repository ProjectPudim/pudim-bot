import { setupCreators } from '@pudim/framework'

export const { createCommand, createEvent, createMiddleware } = setupCreators({
  commands: {
    prefix: 'p.',
  },
})
