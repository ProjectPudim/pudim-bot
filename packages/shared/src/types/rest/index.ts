import { Client } from '@fluxerjs/core'

export type { RestUser } from './user'
export type { RestMember } from './member'
export type { RestRole } from './role'
export type { RestGuild, RestGuildEmoji, RestGuildSticker } from './guild'
export type { RestChannel, RestPermissionOverwrite } from './channel'
export type { RestAttachment } from './attachment'
export type {
  RestEmbed,
  RestEmbedAuthor,
  RestEmbedMedia,
  RestEmbedFooter,
  RestEmbedField,
  RestEmbedProvider,
} from './embed'
export type {
  RestMessage,
  RestEmoji,
  RestReaction,
  RestMessageReference,
  RestChannelMention,
  RestStickerItem,
  RestMessageCall,
  RestMessageSnapshot,
} from './message'
export type { RestBan } from './ban'
export type Rest = Client['rest']
