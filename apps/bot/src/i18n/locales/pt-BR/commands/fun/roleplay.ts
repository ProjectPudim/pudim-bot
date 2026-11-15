import { config } from '#bot/utils/config'
import { emojis } from '#bot/utils/constants'

export default {
  invalidUsage: `${emojis.error} ${config.separator} Para utilizar esse comando, você precisa **informar um usuário** ou o **ID do usuário** para que você possa realizar a ação nele.`,
  bonk: {
    title: [
      'Bonk! 🔨',
      'Marretadinha de leve~ 🪄',
      'Bonk bonk! 💫',
      'Hora do bonk! 🔨',
    ],
    description: (author: string, target: string) => [
      `${author} deu uma marretadinha de brinquedo em ${target}.`,
      `${author} deu um bonk leve em ${target}. Comporte-se, hein!`,
      `${author} mandou um bonk em ${target}, só pra lembrar de ser bonzinho.`,
      `${author} deu uma marretadinha em ${target}. Foi de brincadeira!`,
    ],
  },
  feed: {
    title: ['Nham nham! 🍰', 'Hora da comidinha~ 🍎', 'Olha o aviãozinho~ ✈️'],
    description: (author: string, target: string) => [
      `${author} deu uma comidinha gostosa para ${target}.`,
      `${author} preparou um lanchinho e alimentou ${target}.`,
      `${author} fez "olha o aviãozinho~" e alimentou ${target}.`,
    ],
  },
  hug: {
    title: [
      'Abraço aconchegante 🧸',
      'Abraço apertadinho 🤗',
      'Abraço quentinho ✨',
    ],
    description: (author: string, target: string) => [
      `${author} deu um abraço aconchegante em ${target}.`,
      `${author} abraçou ${target} bem apertadinho.`,
      `${author} envolveu ${target} num abraço fofinho.`,
    ],
  },
  kiss: {
    title: ['Beijinho 💕', 'Beijo carinhoso 💋', 'Mwah~ ✨'],
    description: (author: string, target: string) => [
      `${author} deu um beijinho carinhoso em ${target}.`,
      `${author} mandou um beijo doce para ${target}.`,
      `${author} deu um beijinho na bochecha de ${target}.`,
    ],
  },
  pat: {
    title: ['Cafuné gostoso 🐱', 'Carinho na cabeça ✨', 'Pat pat~ 💕'],
    description: (author: string, target: string) => [
      `${author} fez um cafuné suave em ${target}.`,
      `${author} está fazendo carinho na cabeça de ${target}.`,
      `${author} deu uns headpats carinhosos em ${target}.`,
    ],
  },
  poke: {
    title: ['Cutucadinha 👈', 'Toc toc~ ✨', 'Ei, você! 👉'],
    description: (author: string, target: string) => [
      `${author} cutucou ${target} de leve para chamar a atenção.`,
      `${author} deu uma cutucadinha na bochecha de ${target}.`,
      `${author} cutucou ${target} bem devagarinho. O que será que quer?`,
    ],
  },
  punch: {
    title: ['Soquinho amigável 🥊', 'Soquinho de brincadeira 💥'],
    description: (author: string, target: string) => [
      `${author} deu um soquinho brincalhão no braço de ${target}.`,
      `${author} deu um soquinho de leve em ${target}. Foi só brincadeira!`,
    ],
  },
  slap: {
    title: ['Tapinha brincalhão 👋', 'Plaft! Acorda~ ⚡'],
    description: (author: string, target: string) => [
      `${author} deu um tapinha leve em ${target}.`,
      `${author} deu um tapinha brincalhão em ${target} para acordar pra vida.`,
    ],
  },
  wave: {
    title: ['Oiê! 👋', 'Tchauzinho~ ✨'],
    description: (author: string, target: string) => [
      `${author} acenou alegremente para ${target}.`,
      `${author} mandou um oi animado para ${target}.`,
    ],
  },
  yeet: {
    title: ['Yeet! 🚀', 'Lá vai~ 🌪️', 'Voou longe! 🎈'],
    description: (author: string, target: string) => [
      `${author} arremessou ${target} para longe.`,
      `${author} pegou ${target} e lançou lá para o alto.`,
      `${author} jogou ${target} direto para as nuvens.`,
    ],
  },
}
