import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assetsDir = fileURLToPath(new URL('../../assets/', import.meta.url))

export function getAssetPath(...segments: string[]): string {
  return join(assetsDir, ...segments)
}
