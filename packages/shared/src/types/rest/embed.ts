export interface RestEmbedAuthor {
  name: string
  url?: string
  icon_url?: string
  proxy_icon_url?: string
}

export interface RestEmbedMedia {
  url: string
  proxy_url: string
  width?: number
  height?: number
  duration?: number
  description?: string
  content_type?: string
  content_hash?: string
  placeholder?: string
  flags?: number
}

export interface RestEmbedFooter {
  text: string
  icon_url?: string
  proxy_icon_url?: string
}

export interface RestEmbedField {
  name: string
  value: string
  inline?: boolean
}

export interface RestEmbedProvider {
  name?: string
  url?: string
}

export interface RestEmbed {
  type: string
  title?: string
  description?: string
  url?: string
  timestamp?: string
  color?: number
  author?: RestEmbedAuthor
  provider?: RestEmbedProvider
  thumbnail?: RestEmbedMedia
  image?: RestEmbedMedia
  video?: RestEmbedMedia
  audio?: RestEmbedMedia
  footer?: RestEmbedFooter
  fields?: RestEmbedField[]
  nsfw?: boolean
  html?: string
  html_width?: number
  html_height?: number
  children?: RestEmbed[]
}
