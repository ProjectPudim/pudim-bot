import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { images } from '#bot/utils/constants'
import { getAssetPath } from '../assets'

GlobalFonts.registerFromPath(
  getAssetPath('fonts', 'Quicksand-Regular.ttf'),
  'Quicksand',
)

type ShipImage = Awaited<ReturnType<typeof loadImage>>

const DEFAULT_AVATAR_URL = images.defaultAvatar

let defaultAvatarPromise: Promise<ShipImage> | null = null

function loadDefaultAvatar(): Promise<ShipImage> {
  if (!defaultAvatarPromise) {
    defaultAvatarPromise = loadImage(DEFAULT_AVATAR_URL)
  }
  return defaultAvatarPromise
}

async function loadImageSafe(url: string): Promise<ShipImage> {
  if (!url) {
    return loadDefaultAvatar()
  }

  try {
    return await loadImage(url)
  } catch {
    try {
      return await loadDefaultAvatar()
    } catch {
      throw new Error('Failed to load avatar image')
    }
  }
}

export async function generateShipImage(
  url1: string,
  url2: string,
  percentage: number,
): Promise<Buffer> {
  const safePercentage = Math.max(0, Math.min(100, Math.trunc(percentage)))

  const canvas = createCanvas(900, 350)
  const ctx = canvas.getContext('2d')

  let mainColor: string

  switch (true) {
    case safePercentage >= 91:
      mainColor = '#f03775'
      break
    case safePercentage >= 61:
      mainColor = '#ff3333'
      break
    case safePercentage >= 46:
      mainColor = '#f7971e'
      break
    case safePercentage >= 21:
      mainColor = '#995605'
      break
    default:
      mainColor = '#636e72'
      break
  }

  const centerImagePath = (() => {
    switch (true) {
      case safePercentage > 90:
        return 'sparkling-heart.png'
      case safePercentage > 60:
        return 'heart-red.png'
      case safePercentage > 35:
        return 'shrugging.png'
      case safePercentage > 20:
        return 'crying.png'
      default:
        return 'broken-heart.png'
    }
  })()

  const [avatar1, avatar2, centerImg] = await Promise.all([
    loadImageSafe(url1),
    loadImageSafe(url2),
    loadImage(getAssetPath('images', centerImagePath)).catch(() => null),
  ])

  ctx.drawImage(avatar1, 0, 0, 300, 300)
  ctx.drawImage(avatar2, 600, 0, 300, 300)

  if (centerImg) {
    ctx.drawImage(centerImg, 310, 10, 280, 280)
  }

  const barHeight = 50
  const barY = 300
  const progressWidth = (safePercentage / 100) * 900

  const borderRadius = safePercentage >= 100 ? 0 : 20

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, barY, 900, barHeight)

  if (progressWidth > 0) {
    ctx.fillStyle = mainColor

    ctx.beginPath()
    ctx.roundRect(0, barY, progressWidth, barHeight, [
      0,
      borderRadius,
      borderRadius,
      0,
    ])
    ctx.fill()

    const patternCanvas = createCanvas(20, 20)
    const pctx = patternCanvas.getContext('2d')
    pctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    pctx.beginPath()
    pctx.moveTo(0, 20)
    pctx.lineTo(10, 0)
    pctx.lineTo(20, 0)
    pctx.lineTo(10, 20)
    pctx.fill()

    const pattern = ctx.createPattern(patternCanvas, 'repeat')
    if (pattern) {
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(0, barY, progressWidth, barHeight, [
        0,
        borderRadius,
        borderRadius,
        0,
      ])
      ctx.clip()
      ctx.fillStyle = pattern
      ctx.fillRect(0, barY, progressWidth, barHeight)
      ctx.restore()
    }
  }

  ctx.font = 'bold 35px Quicksand'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 2

  ctx.fillStyle = '#ffffff'
  ctx.fillText(`${safePercentage}%`, 450, barY + barHeight / 2)

  ctx.shadowColor = 'transparent'

  return canvas.toBuffer('image/png')
}
