import { config, emojis } from '#bot/config'

export default {
  messages: {
    missingQuestion: `${emojis.error} ${config.separator} Você precisa informar uma **pergunta** para que eu possa responder.`,
    tooLong: (max: number) =>
      `${emojis.error} ${config.separator} Sua pergunta deve ter no máximo **${max} caracteres**.`,
  },
  title: 'Magic 8-Ball',
  question: 'Pergunta',
  answer: 'Resposta',

  responses: {
    positive: [
      'Com certeza!',
      'Sem dúvidas!',
      'Definitivamente sim.',
      'Tudo indica que sim.',
      'Pode apostar que sim!',
      'Os sinais apontam para sim.',
      'É muito provável.',
      'Minha resposta é sim!',
      'Absolutamente!',
      'O destino está a seu favor.',
      'Pode confiar!',
      'As chances são excelentes.',
    ],
    negative: [
      'Definitivamente não.',
      'Nem pensar!',
      'Minhas fontes dizem que não.',
      'As chances são muito baixas.',
      'Não conte com isso.',
      'Melhor não criar expectativas.',
      'Tudo indica que não.',
      'Minha resposta é não.',
      'Dificilmente.',
      'Parece que não vai acontecer.',
      'O destino não está a seu favor.',
      'Acho melhor desistir dessa ideia.',
    ],
    neutral: [
      'Talvez...',
      'É possível.',
      'Ainda é cedo para saber.',
      'Pergunte novamente mais tarde.',
      'Não consigo prever isso agora.',
      'Os sinais estão confusos.',
      'Existe uma possibilidade.',
      'Depende de muitas coisas.',
      'O futuro ainda não decidiu.',
      'Melhor esperar para descobrir.',
      'Pode ser que sim, pode ser que não.',
      'Minha previsão está um pouco nebulosa.',
    ],
  },
}
