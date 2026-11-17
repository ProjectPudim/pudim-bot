import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const assetsDir = fileURLToPath(
  new URL('../../assets/', import.meta.url),
)

export function getAssetPath(...segments: string[]): string {
  return join(assetsDir, ...segments)
}