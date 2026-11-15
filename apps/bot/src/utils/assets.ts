import { join } from 'node:path'

export function getAssetPath(...segments: string[]): string {
  return join(process.cwd(), 'assets', ...segments)
}
