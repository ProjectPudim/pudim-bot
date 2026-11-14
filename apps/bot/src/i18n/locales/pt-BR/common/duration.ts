export default {
  seconds: (value: number) =>
    `${value} ${value === 1 ? 'segundo' : 'segundos'}`,
  minutes: (value: number) => `${value} ${value === 1 ? 'minuto' : 'minutos'}`,
  hours: (value: number) => `${value} ${value === 1 ? 'hora' : 'horas'}`,
  days: (value: number) => `${value} ${value === 1 ? 'dia' : 'dias'}`,
  weeks: (value: number) => `${value} ${value === 1 ? 'semana' : 'semanas'}`,
  months: (value: number) => `${value} ${value === 1 ? 'mês' : 'meses'}`,
  years: (value: number) => `${value} ${value === 1 ? 'ano' : 'anos'}`,
  examples:
    'Para indicar o tempo você pode usar assim: `30s`, `5m`, `1h 30m`, `2 dias`, `30 minutos e 10 segundos`.',
  min: (value: string) => `O tempo mínimo é ${value}.`,
  max: (value: string) => `O tempo máximo é ${value}.`,
}
