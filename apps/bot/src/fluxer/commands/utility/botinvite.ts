import { Category, config } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { Embed } from '#bot/utils'

export default createCommand({
  name: 'botinvite',
  description: 'Shows an invite link for the bot.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra um link de convite para o bot.',
    'es-ES': 'Muestra un enlace de invitación para el bot.',
  },
  category: Category.Utilities,
  aliases: ['support'],
  usage: '{prefix}botinvite',
  async run(ctx) {
    const { t, prefix, client } = ctx
    const botAvatar = client.user!.displayAvatarURL()

    const embed = Embed({
      author: {
        name: t('commands.botinvite.author.name'),
        iconUrl: botAvatar,
        url: config.links.botInvite,
      },
      description: t('commands.botinvite.description'),
      thumbnail: botAvatar,
      footer: { text: `${prefix}help` },
      timestamp: true,
    })

    await ctx.reply({ embeds: [embed] })
  },
})
