export interface TaskContext {
  id: string
  runCount: number
  scheduledFor: Date
}

export type TaskHandler = (ctx: TaskContext) => void | Promise<void>

export type Trigger =
  | { type: 'once'; at: Date | number }
  | { type: 'every'; ms: number }
  | { type: 'cron'; expression: string }

export interface TaskOptions {
  id?: string
  /** Default: false. If the previous run is still in progress, the new one is skipped. */
  overlap?: boolean
  /** Only applies to `every`. */
  immediate?: boolean
  maxRuns?: number
  /** Lets the process exit while the task is still pending. */
  unref?: boolean
  /** Default: console.error. */
  onError?: (error: unknown, ctx: TaskContext) => void
}

export interface TaskInfo {
  id: string
  type: Trigger['type']
  paused: boolean
  running: boolean
  runCount: number
  nextRun: Date | null
}

interface Task {
  id: string
  trigger: Trigger
  handler: TaskHandler
  options: TaskOptions
  cron?: CronSpec
  timer?: ReturnType<typeof setTimeout>
  nextRun: number | null
  paused: boolean
  activeRuns: number
  runCount: number
}

interface CronSpec {
  minute: Set<number>
  hour: Set<number>
  dom: Set<number>
  month: Set<number>
  dow: Set<number>
  domAny: boolean
  dowAny: boolean
}

const CRON_ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

function parseCronField(
  field: string,
  min: number,
  max: number,
  label: string,
): Set<number> {
  const values = new Set<number>()

  for (const part of field.split(',')) {
    const [rangePart, stepPart, extra] = part.split('/')
    if (extra !== undefined || rangePart === '') {
      throw new Error(`Cron inválido no campo ${label}: "${field}"`)
    }

    const step = stepPart === undefined ? 1 : Number(stepPart)
    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`Passo inválido no campo ${label}: "${field}"`)
    }

    let start: number
    let end: number

    if (rangePart === '*') {
      start = min
      end = max
    } else if (rangePart!.includes('-')) {
      const [a, b] = rangePart!.split('-').map(Number)
      start = a!
      end = b!
    } else {
      start = Number(rangePart)
      end = stepPart === undefined ? start : max
    }

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < min ||
      end > max ||
      start > end
    ) {
      throw new Error(
        `Valor fora do intervalo (${min}-${max}) no campo ${label}: "${field}"`,
      )
    }

    for (let v = start; v <= end; v += step) values.add(v)
  }

  return values
}

function parseCron(expression: string): CronSpec {
  const normalized =
    CRON_ALIASES[expression.trim().toLowerCase()] ?? expression.trim()
  const fields = normalized.split(/\s+/)
  if (fields.length !== 5) {
    throw new Error(
      `Cron deve ter 5 campos (min hora dia mês dia-semana): "${expression}"`,
    )
  }

  const [min, hour, dom, month, dow] = fields as [
    string,
    string,
    string,
    string,
    string,
  ]

  const dowSet = parseCronField(dow, 0, 7, 'dia-da-semana')
  // 7 also stands for Sunday.
  if (dowSet.has(7)) {
    dowSet.delete(7)
    dowSet.add(0)
  }

  return {
    minute: parseCronField(min, 0, 59, 'minuto'),
    hour: parseCronField(hour, 0, 23, 'hora'),
    dom: parseCronField(dom, 1, 31, 'dia-do-mês'),
    month: parseCronField(month, 1, 12, 'mês'),
    dow: dowSet,
    domAny: dom.startsWith('*'),
    dowAny: dow.startsWith('*'),
  }
}

// Uses the process time zone; set TZ to change it.
function nextCronDate(spec: CronSpec, from: number): number | null {
  const d = new Date(from)
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() + 1)

  for (let i = 0; i < 200_000; i++) {
    if (!spec.month.has(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1)
      d.setHours(0, 0, 0, 0)
      continue
    }

    const domMatch = spec.dom.has(d.getDate())
    const dowMatch = spec.dow.has(d.getDay())
    // When both day-of-month and day-of-week are restricted, cron matches either one (OR).
    const dayOk =
      spec.domAny && spec.dowAny
        ? true
        : spec.domAny
          ? dowMatch
          : spec.dowAny
            ? domMatch
            : domMatch || dowMatch

    if (!dayOk) {
      d.setDate(d.getDate() + 1)
      d.setHours(0, 0, 0, 0)
      continue
    }

    if (!spec.hour.has(d.getHours())) {
      d.setHours(d.getHours() + 1, 0, 0, 0)
      continue
    }

    if (!spec.minute.has(d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1, 0, 0)
      continue
    }

    return d.getTime()
  }

  return null
}

// setTimeout overflows above 2^31 - 1 ms.
const MAX_TIMEOUT = 2_147_483_647

export class ScheduleManager {
  private tasks = new Map<string, Task>()

  once(
    when: Date | number,
    handler: TaskHandler,
    options: TaskOptions = {},
  ): string {
    const at = when instanceof Date ? when.getTime() : Date.now() + when
    return this.schedule({ type: 'once', at }, handler, options)
  }

  every(ms: number, handler: TaskHandler, options: TaskOptions = {}): string {
    return this.schedule({ type: 'every', ms }, handler, options)
  }

  cron(
    expression: string,
    handler: TaskHandler,
    options: TaskOptions = {},
  ): string {
    return this.schedule({ type: 'cron', expression }, handler, options)
  }

  schedule(
    trigger: Trigger,
    handler: TaskHandler,
    options: TaskOptions = {},
  ): string {
    const id = options.id ?? crypto.randomUUID()
    if (this.tasks.has(id))
      throw new Error(`Já existe uma tarefa com id "${id}"`)

    const task: Task = {
      id,
      trigger,
      handler,
      options,
      nextRun: null,
      paused: false,
      activeRuns: 0,
      runCount: 0,
    }

    if (trigger.type === 'every') {
      if (!Number.isFinite(trigger.ms) || trigger.ms <= 0) {
        throw new Error('O intervalo (ms) deve ser um número positivo')
      }
    } else if (trigger.type === 'cron') {
      task.cron = parseCron(trigger.expression)
    } else {
      const at = trigger.at instanceof Date ? trigger.at.getTime() : trigger.at
      if (!Number.isFinite(at))
        throw new Error('Data inválida para a tarefa once')
    }

    const first = this.computeFirst(task)
    if (first === null) {
      throw new Error('Não foi possível calcular a próxima execução')
    }

    this.tasks.set(id, task)
    this.arm(task, first)
    return id
  }

  cancel(id: string): boolean {
    const task = this.tasks.get(id)
    if (!task) return false
    this.disarm(task)
    this.tasks.delete(id)
    return true
  }

  pause(id: string): boolean {
    const task = this.tasks.get(id)
    if (!task || task.paused) return false
    task.paused = true
    this.disarm(task)
    task.nextRun = null
    return true
  }

  /** The next run is recalculated from now. */
  resume(id: string): boolean {
    const task = this.tasks.get(id)
    if (!task || !task.paused) return false
    task.paused = false

    const next = this.computeNext(task, Date.now())
    if (next === null) {
      this.tasks.delete(id)
      return false
    }
    this.arm(task, next)
    return true
  }

  /** Does not affect the schedule. */
  async runNow(id: string): Promise<void> {
    const task = this.tasks.get(id)
    if (!task) throw new Error(`Tarefa "${id}" não encontrada`)
    await this.execute(task, new Date())
  }

  clear(): void {
    for (const task of this.tasks.values()) this.disarm(task)
    this.tasks.clear()
  }

  has(id: string): boolean {
    return this.tasks.has(id)
  }

  get(id: string): TaskInfo | undefined {
    const task = this.tasks.get(id)
    return task ? this.info(task) : undefined
  }

  list(): TaskInfo[] {
    return [...this.tasks.values()].map((t) => this.info(t))
  }

  get size(): number {
    return this.tasks.size
  }

  private info(task: Task): TaskInfo {
    return {
      id: task.id,
      type: task.trigger.type,
      paused: task.paused,
      running: task.activeRuns > 0,
      runCount: task.runCount,
      nextRun: task.nextRun === null ? null : new Date(task.nextRun),
    }
  }

  private computeFirst(task: Task): number | null {
    const { trigger } = task
    if (trigger.type === 'once') {
      return trigger.at instanceof Date ? trigger.at.getTime() : trigger.at
    }
    if (trigger.type === 'every') {
      return task.options.immediate ? Date.now() : Date.now() + trigger.ms
    }
    return nextCronDate(task.cron!, Date.now())
  }

  private computeNext(task: Task, from: number): number | null {
    const { trigger } = task
    if (trigger.type === 'once') return null

    if (trigger.type === 'every') {
      // Adds to the scheduled time (not the current one) to avoid accumulating drift;
      // if already late, restarts from now.
      const next = from + trigger.ms
      return next < Date.now() ? Date.now() + trigger.ms : next
    }

    return nextCronDate(task.cron!, Math.max(from, Date.now()))
  }

  private arm(task: Task, runAt: number): void {
    task.nextRun = runAt
    const delay = Math.max(0, runAt - Date.now())
    const wait = Math.min(delay, MAX_TIMEOUT)

    const timer = setTimeout(() => {
      task.timer = undefined
      if (this.tasks.get(task.id) !== task || task.paused) return

      if (delay > MAX_TIMEOUT) {
        this.arm(task, runAt)
      } else {
        void this.fire(task, runAt)
      }
    }, wait)

    if (task.options.unref) (timer as { unref?: () => void }).unref?.()
    task.timer = timer
  }

  private disarm(task: Task): void {
    if (task.timer !== undefined) {
      clearTimeout(task.timer)
      task.timer = undefined
    }
  }

  private async fire(task: Task, scheduledFor: number): Promise<void> {
    const { maxRuns } = task.options
    const willStop =
      task.trigger.type === 'once' ||
      (maxRuns !== undefined && task.runCount + 1 >= maxRuns)

    // Reschedule before running so the handler's duration doesn't delay the next cycle.
    if (willStop) {
      task.nextRun = null
    } else {
      const next = this.computeNext(task, scheduledFor)
      if (next === null) {
        task.nextRun = null
      } else {
        this.arm(task, next)
      }
    }

    await this.execute(task, new Date(scheduledFor))

    if (willStop && this.tasks.get(task.id) === task) {
      this.tasks.delete(task.id)
    }
  }

  private async execute(task: Task, scheduledFor: Date): Promise<void> {
    if (task.activeRuns > 0 && !task.options.overlap) return

    task.activeRuns++
    task.runCount++
    const ctx: TaskContext = {
      id: task.id,
      runCount: task.runCount,
      scheduledFor,
    }

    try {
      await task.handler(ctx)
    } catch (error) {
      if (task.options.onError) {
        try {
          task.options.onError(error, ctx)
        } catch {
          // A failing onError must not take down the scheduler.
        }
      } else {
        console.error(`[ScheduleManager] Erro na tarefa "${task.id}":`, error)
      }
    } finally {
      task.activeRuns--
    }
  }
}

export const scheduleManager = new ScheduleManager()

export default ScheduleManager
