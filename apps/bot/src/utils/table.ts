export interface TableColumn {
  header: string
  align?: 'left' | 'center' | 'right'
}

export interface BuildTableOptions {
  headers?: string[]
  rows: string[][]
  align?: Array<'left' | 'center' | 'right'>
}

function pad(
  value: string,
  width: number,
  align: 'left' | 'center' | 'right',
): string {
  if (value.length >= width) return value
  const space = width - value.length
  if (align === 'right') return ' '.repeat(space) + value
  if (align === 'center') {
    const left = Math.floor(space / 2)
    const right = space - left
    return ' '.repeat(left) + value + ' '.repeat(right)
  }
  return value + ' '.repeat(space)
}

export function buildTable(options: BuildTableOptions): string
export function buildTable(headers: string[], rows: string[][]): string
export function buildTable(
  headersOrOptions: string[] | BuildTableOptions,
  rowsArg?: string[][],
): string {
  const options = Array.isArray(headersOrOptions)
    ? { headers: headersOrOptions, rows: rowsArg ?? [] }
    : headersOrOptions

  const { headers = [], rows } = options
  const align = options.align ?? headers.map(() => 'left')

  const columnCount = Math.max(
    headers.length,
    ...rows.map((row) => row.length),
    0,
  )

  const widths: number[] = Array.from({ length: columnCount }, (_, index) => {
    const headerWidth = headers[index]?.length ?? 0
    const rowWidth = Math.max(0, ...rows.map((row) => row[index]?.length ?? 0))
    return Math.max(headerWidth, rowWidth, 1)
  })

  const normalizeRow = (row: string[]) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? '')

  const separator = widths
    .map((width, index) => {
      const a = align[index] ?? 'left'
      if (a === 'center') return `:${'-'.repeat(Math.max(width - 2, 1))}:`
      if (a === 'right') return `${'-'.repeat(Math.max(width - 1, 1))}:`
      return '-'.repeat(width)
    })
    .join(' | ')

  const lines: string[] = []
  if (headers.length) {
    lines.push(
      `| ${normalizeRow(headers)
        .map((value, index) =>
          pad(value, widths[index] ?? 1, align[index] ?? 'left'),
        )
        .join(' | ')} |`,
    )
    lines.push(`| ${separator} |`)
  }
  for (const row of rows) {
    lines.push(
      `| ${normalizeRow(row)
        .map((value, index) =>
          pad(value, widths[index] ?? 1, align[index] ?? 'left'),
        )
        .join(' | ')} |`,
    )
  }

  return lines.join('\n')
}

export { buildTable as createTable }
