import { createCommand } from '#bot/fluxer'
import { config } from '#bot/utils/config'
import { Embed } from '#bot/utils/embed'

export default createCommand({
  name: 'botinvite',
  description: 'Shows an invite link for the bot.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra um link de convite para o bot.',
    'es-ES': 'Muestra un enlace de invitación para el bot.',
  },
  category: 'utility',
  aliases: ['support'],
  usage: '{prefix}botinvite',
  async run(ctx) {
    const { t } = ctx
    const botInvite = config.links.botInvite
    const botAvatar = ctx.client.user!.displayAvatarURL()

    const embed = Embed({
      author: {
        name: t('commands.botinvite.author.name'),
        iconUrl: botAvatar,
        url: botInvite,
      },
      description: t('commands.botinvite.description'),
      thumbnail: botAvatar,
      footer: { text: `${ctx.prefix}help` },
      timestamp: true,
    })

    await ctx.reply({ embeds: [embed] })
    return
  },
})
