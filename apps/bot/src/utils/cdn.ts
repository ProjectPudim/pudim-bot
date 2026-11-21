import type { Guild, User } from '@fluxerjs/core'
import { images } from '#bot/config'
import type { FluxerProfile } from './fluxer-profile'

type ImageSize = 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096

function withAnimatedGif(
  url: string | null | undefined,
  hash: string | null | undefined,
): string | null {
  if (!url) return null
  if (hash?.startsWith('a_')) {
    return url.replace(/\.(?:png|webp)(\?|$)/, '.gif$1')
  }
  return url
}

export function getUserAvatarUrl(
  user: User | null | undefined,
  options: {
    size?: ImageSize
    profile?: FluxerProfile | null
    fallback?: boolean
  } = {},
): string | null {
  const { size = 512, profile, fallback = false } = options

  if (profile?.avatarUrl) return profile.avatarUrl

  if (user?.avatar) {
    const extension = user.avatar.startsWith('a_') ? 'gif' : 'png'
    const url = user.avatarURL({ size, extension })
    if (url) return url
  }

  return fallback ? images.defaultAvatar : null
}

export function getUserBannerUrl(
  userId: string,
  user: User | null | undefined,
  profile?: FluxerProfile | null,
  size: ImageSize = 1024,
): string | null {
  if (user?.banner) {
    const extension = user.banner.startsWith('a_') ? 'gif' : 'png'
    const url = user.bannerURL({ size, extension })
    if (url) return url
  }

  if (profile?.profile?.bannerUrl) {
    return profile.profile.bannerUrl
  }

  const bannerHash = profile?.profile?.banner
  if (bannerHash) {
    const extension = bannerHash.startsWith('a_') ? 'gif' : 'png'
    return `https://fluxerusercontent.com/banners/${userId}/${bannerHash}.${extension}?size=${size}`
  }

  return null
}

export function getGuildIconUrl(
  guild: Pick<Guild, 'icon' | 'iconURL'>,
  size: ImageSize = 512,
): string | null {
  return withAnimatedGif(guild.iconURL({ size }), guild.icon)
}

export function getGuildBannerUrl(
  guild: Pick<Guild, 'banner' | 'bannerURL'>,
  size?: ImageSize,
): string | null {
  const baseUrl = size ? guild.bannerURL({ size }) : guild.bannerURL()
  return withAnimatedGif(baseUrl, guild.banner)
}

export function getSnapshotGuildIconUrl(
  guildId: string | null | undefined,
  iconHash: string | null | undefined,
  size: ImageSize = 256,
): string | undefined {
  if (!guildId || !iconHash) return undefined
  const extension = iconHash.startsWith('a_') ? 'gif' : 'png'
  return `https://fluxerusercontent.com/icons/${guildId}/${iconHash}.${extension}?size=${size}`
}
