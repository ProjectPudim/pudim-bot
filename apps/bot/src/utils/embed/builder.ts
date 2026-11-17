import { EmbedBuilder } from '@fluxerjs/core'
import { colors } from '#bot/config'

export interface EmbedField {
  name: string
  value: string | string[]
  inline?: boolean
}

export interface EmbedFooter {
  text: string
  iconUrl?: string
}

export interface EmbedAuthor {
  name: string
  iconUrl?: string
  url?: string
}

export interface EmbedOptions {
  title?: string
  description?: string | string[]
  color?: string
  author?: EmbedAuthor
  fields?: EmbedField[]
  thumbnail?: string
  image?: string
  footer?: EmbedFooter
  timestamp?: boolean
}

const MAX_FIELDS = 25

const joinLines = (text: string | string[]) =>
  Array.isArray(text) ? text.join('\n') : text

export function Embed(
  description: string | string[],
  color?: string,
): EmbedBuilder
export function Embed(options: EmbedOptions): EmbedBuilder
export function Embed(
  inputOrDescription: string | string[] | EmbedOptions,
  color?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()

  if (
    typeof inputOrDescription === 'string' ||
    Array.isArray(inputOrDescription)
  ) {
    embed.setDescription(joinLines(inputOrDescription))
    embed.setColor(color ?? colors.primary)
    return embed
  }

  const options = inputOrDescription

  if (options.author?.name) {
    embed.setAuthor({
      name: options.author.name,
      iconURL: options.author.iconUrl,
      url: options.author.url,
    })
  }

  if (options.title) embed.setTitle(options.title)
  if (options.description) embed.setDescription(joinLines(options.description))

  embed.setColor(options.color ?? colors.primary)

  if (options.fields?.length) {
    const fields = options.fields
      .map((field) => ({
        name: field.name.trim(),
        value: joinLines(field.value).trim(),
        inline: field.inline ?? false,
      }))
      .filter((field) => field.name && field.value)
      .slice(0, MAX_FIELDS)

    if (fields.length) embed.addFields(...fields)
  }

  if (options.thumbnail) embed.setThumbnail(options.thumbnail)
  if (options.image) embed.setImage(options.image)
  if (options.footer) {
    embed.setFooter({
      text: options.footer.text,
      iconURL: options.footer.iconUrl,
    })
  }
  if (options.timestamp === true) embed.setTimestamp()

  return embed
}
