export default (mention: string, seconds: number) =>
  `⏰ Ei, ${mention}! Você precisa esperar mais **${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}** antes de usar esse comando novamente!`
