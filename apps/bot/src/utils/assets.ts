import { fileURLToPath } from 'node:url'

const assetsUrl = new URL('../../assets/', import.meta.url)

export function getAssetPath(...segments: string[]): string {
  const relativePath = segments.join('/')
  return fileURLToPath(new URL(relativePath, assetsUrl))
}
