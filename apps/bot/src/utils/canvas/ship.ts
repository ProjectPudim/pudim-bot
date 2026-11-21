import {
  createCanvas,
  GlobalFonts,
  loadImage,
  type Canvas,
} from '@napi-rs/canvas'
import { images } from '#bot/config'
import { getAssetPath } from '#bot/utils/assets'

GlobalFonts.registerFromPath(
  getAssetPath('fonts', 'Quicksand-Regular.ttf'),
  'Quicksand',
)

type LoadedImage = Awaited<ReturnType<typeof loadImage>>

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 350
const AVATAR_SIZE = 300
const BAR_Y = 300
const BAR_HEIGHT = 50

let defaultAvatarPromise: Promise<LoadedImage> | null = null
const assetImageCache = new Map<string, Promise<LoadedImage | null>>()
let stripePatternCanvas: Canvas | null = null

function getDefaultAvatar(): Promise<LoadedImage> {
  defaultAvatarPromise ??= loadImage(images.defaultAvatar)
  return defaultAvatarPromise
}

function getCenterAsset(filename: string): Promise<LoadedImage | null> {
  let cached = assetImageCache.get(filename)
  if (!cached) {
    cached = loadImage(getAssetPath('images', filename)).catch(() => null)
    assetImageCache.set(filename, cached)
  }
  return cached
}

async function loadAvatarSafe(url: string): Promise<LoadedImage> {
  if (!url) return getDefaultAvatar()

  try {
    return await loadImage(url)
  } catch {
    return getDefaultAvatar()
  }
}

function resolveBarColor(percentage: number): string {
  if (percentage >= 91) return '#f03775'
  if (percentage >= 61) return '#ff3333'
  if (percentage >= 46) return '#f7971e'
  if (percentage >= 21) return '#995605'
  return '#636e72'
}

function resolveCenterIcon(percentage: number): string {
  if (percentage > 90) return 'sparkling-heart.png'
  if (percentage > 60) return 'heart-red.png'
  if (percentage > 35) return 'shrugging.png'
  if (percentage > 20) return 'crying.png'
  return 'broken-heart.png'
}

function getStripeTile(): Canvas {
  if (stripePatternCanvas) return stripePatternCanvas

  const tile = createCanvas(20, 20)
  const pctx = tile.getContext('2d')
  pctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
  pctx.beginPath()
  pctx.moveTo(0, 20)
  pctx.lineTo(10, 0)
  pctx.lineTo(20, 0)
  pctx.lineTo(10, 20)
  pctx.fill()

  stripePatternCanvas = tile
  return tile
}

export async function generateShipImage(
  url1: string,
  url2: string,
  percentage: number,
): Promise<Buffer> {
  const safePercentage = Math.max(0, Math.min(100, Math.trunc(percentage)))
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)
  const ctx = canvas.getContext('2d')

  const [avatar1, avatar2, centerImg] = await Promise.all([
    loadAvatarSafe(url1),
    loadAvatarSafe(url2),
    getCenterAsset(resolveCenterIcon(safePercentage)),
  ])

  ctx.drawImage(avatar1, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  ctx.drawImage(avatar2, 600, 0, AVATAR_SIZE, AVATAR_SIZE)

  if (centerImg) {
    ctx.drawImage(centerImg, 310, 10, 280, 280)
  }

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, BAR_Y, CANVAS_WIDTH, BAR_HEIGHT)

  const progressWidth = (safePercentage / 100) * CANVAS_WIDTH
  if (progressWidth > 0) {
    const borderRadius = safePercentage >= 100 ? 0 : 20
    const radii: [number, number, number, number] = [
      0,
      borderRadius,
      borderRadius,
      0,
    ]

    ctx.fillStyle = resolveBarColor(safePercentage)
    ctx.beginPath()
    ctx.roundRect(0, BAR_Y, progressWidth, BAR_HEIGHT, radii)
    ctx.fill()

    const pattern = ctx.createPattern(getStripeTile(), 'repeat')
    if (pattern) {
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(0, BAR_Y, progressWidth, BAR_HEIGHT, radii)
      ctx.clip()
      ctx.fillStyle = pattern
      ctx.fillRect(0, BAR_Y, progressWidth, BAR_HEIGHT)
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
  ctx.fillText(`${safePercentage}%`, CANVAS_WIDTH / 2, BAR_Y + BAR_HEIGHT / 2)
  ctx.shadowColor = 'transparent'

  return canvas.toBuffer('image/png')
}
