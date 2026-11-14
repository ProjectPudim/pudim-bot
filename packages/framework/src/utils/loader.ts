import { readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const DEFAULT_MODULE_EXTENSIONS = [
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
] as const

export interface DiscoverFilesOptions {
  recursive?: boolean
  extensions?: readonly string[]
  filter?: (filePath: string) => boolean
}

function isLoadableFile(name: string): boolean {
  return (
    !name.startsWith('_') &&
    !name.startsWith('.') &&
    !/\.d\.(?:ts|mts|cts)$/i.test(name) &&
    !/\.(?:test|spec)\.[^.]+$/i.test(name)
  )
}

export async function discoverFiles(
  directory: string,
  options: DiscoverFilesOptions = {},
): Promise<string[]> {
  const recursive = options.recursive ?? true
  const extensions = new Set(
    (options.extensions ?? DEFAULT_MODULE_EXTENSIONS).map((ext) =>
      ext.toLowerCase(),
    ),
  )

  const files: string[] = []

  const walk = async (dir: string): Promise<void> => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch (error) {
      throw new Error(`[core] Directory not found: "${dir}"`, { cause: error })
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        if (
          entry.name.startsWith('_') ||
          entry.name.startsWith('.') ||
          entry.name === 'node_modules'
        )
          continue
        if (recursive) await walk(fullPath)
        continue
      }

      if (!entry.isFile()) continue
      if (!isLoadableFile(entry.name)) continue

      const ext = extname(entry.name).toLowerCase()
      if (!extensions.has(ext)) continue
      if (options.filter && !options.filter(fullPath)) continue

      files.push(fullPath)
    }
  }

  await walk(resolve(directory))
  return files.sort()
}

const isBun = 'bun' in process.versions

/**
 * `pathToFileURL` is required on Windows, where `C:\...` is not a valid import specifier.
 * A `generation` bypasses the module cache: Node needs a new query string, while Bun
 * ignores the query on file URLs and needs the module evicted from its registry.
 */
export async function importModule(
  filePath: string,
  generation?: number,
): Promise<Record<string, unknown>> {
  const base = pathToFileURL(filePath).href
  let url = base
  if (generation !== undefined) {
    if (isBun) delete require.cache[filePath]
    else url = `${base}?v=${generation}`
  }
  try {
    const namespace: unknown = await import(url)
    return namespace as Record<string, unknown>
  } catch (error) {
    throw new Error(`[core] Failed to import "${filePath}".`, { cause: error })
  }
}

export function collectModuleValues(
  namespace: Record<string, unknown>,
): unknown[] {
  const values: unknown[] = []
  const seen = new Set<unknown>()

  for (const [key, value] of Object.entries(namespace)) {
    if (key === '__esModule') continue
    if (value === undefined || value === null) continue
    if (seen.has(value)) continue
    seen.add(value)
    values.push(value)
  }

  return values
}

const MAGIC_RE = /[*?{]/

function escapeRegExpChar(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Supports `*`, `**`, `?` and `{a,b}` */
export function globToRegExp(glob: string): RegExp {
  return new RegExp(`^${globSource(glob)}$`)
}

function globSource(glob: string): string {
  let out = ''
  let i = 0

  while (i < glob.length) {
    const ch = glob[i]!

    if (ch === '*') {
      if (glob[i + 1] === '*') {
        i += 2
        if (glob[i] === '/') {
          out += '(?:[^/]+/)*'
          i += 1
        } else {
          out += '.*'
        }
      } else {
        out += '[^/]*'
        i += 1
      }
      continue
    }

    if (ch === '?') {
      out += '[^/]'
      i += 1
      continue
    }

    if (ch === '{') {
      const close = glob.indexOf('}', i)
      if (close === -1) {
        out += escapeRegExpChar(ch)
        i += 1
        continue
      }
      const alternatives = glob
        .slice(i + 1, close)
        .split(',')
        .map((alt) => globSource(alt))
      out += `(?:${alternatives.join('|')})`
      i = close + 1
      continue
    }

    out += escapeRegExpChar(ch)
    i += 1
  }

  return out
}

/** Missing directories yield no matches instead of an error */
async function walkForGlob(dir: string, files: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return
    throw error
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      if (
        entry.name.startsWith('_') ||
        entry.name.startsWith('.') ||
        entry.name === 'node_modules'
      )
        continue
      await walkForGlob(fullPath, files)
      continue
    }

    if (!entry.isFile()) continue
    if (!isLoadableFile(entry.name)) continue

    files.push(fullPath)
  }
}

export async function expandGlob(
  pattern: string,
  cwd: string,
): Promise<string[]> {
  const normalized = pattern.replace(/\\/g, '/').replace(/^\.\//, '')
  const magicIndex = normalized.search(MAGIC_RE)
  if (magicIndex === -1) {
    const file = resolve(cwd, normalized)
    if (!isLoadableFile(file.split(/[\\/]/).at(-1) ?? '')) return []
    try {
      return (await stat(file)).isFile() ? [file] : []
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return []
      throw error
    }
  }

  const cutAt = (
    magicIndex === -1 ? normalized : normalized.slice(0, magicIndex)
  ).lastIndexOf('/')
  const baseRel = cutAt === -1 ? '' : normalized.slice(0, cutAt)
  const base = baseRel ? resolve(cwd, baseRel) : resolve(cwd)

  const regex = globToRegExp(normalized)
  const prefix = baseRel ? `${baseRel}/` : ''

  const files: string[] = []
  await walkForGlob(base, files)

  return files
    .filter((file) => {
      const rel = prefix + relative(base, file).split('\\').join('/')
      return regex.test(rel)
    })
    .sort()
}

export interface LoadedModule {
  file: string
  module: Record<string, unknown>
}

export async function loadModules(
  meta: ImportMeta,
  patterns: string[],
  generation?: number,
): Promise<LoadedModule[]> {
  const cwd = dirname(fileURLToPath(meta.url))

  const positives = patterns.filter((p) => !p.startsWith('!'))
  const negatives = patterns
    .filter((p) => p.startsWith('!'))
    .map((p) => p.slice(1))

  const files = new Set<string>()
  for (const pattern of positives) {
    for (const file of await expandGlob(pattern, cwd)) files.add(file)
  }
  for (const pattern of negatives) {
    for (const file of await expandGlob(pattern, cwd)) files.delete(file)
  }

  const imports: LoadedModule[] = []
  for (const file of [...files].sort()) {
    imports.push({ file, module: await importModule(file, generation) })
  }
  return imports
}
