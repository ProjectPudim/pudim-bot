export default {
  title: '🏓 Pong!',
  gateway: (ping: number) => `**Latência do Gateway:** \`${ping}ms\``,
  response: (ms: number | string) => `**Tempo de Resposta:** \`${ms}ms\``,
}
